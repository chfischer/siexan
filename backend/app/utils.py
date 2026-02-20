import pandas as pd
import io
from typing import Dict, Any, List
from datetime import datetime

def clean_amount(val: Any) -> float:
    if pd.isna(val) or val == '':
        return 0.0
    s = str(val).strip()
    
    # Remove currency symbols and common non-numeric chars (except dot, comma, minus, plus)
    # Using a whitelist approach for characters to keep
    s = "".join(c for c in s if c.isdigit() or c in '.,-()+')
    
    if not s: return 0.0

    # Handle parentheses for negative numbers: (100.00) -> -100.00
    if s.startswith('(') and s.endswith(')'):
        s = '-' + s[1:-1]
        
    # Standardize on dot as decimal separator
    # Case 1: Multiple dots/commas (definitely thousands separators)
    # Case 2: One dot and one comma
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'): # 1.234,56
            s = s.replace('.', '').replace(',', '.')
        else: # 1,234.56
            s = s.replace(',', '')
    elif ',' in s:
        # One or more commas, no dots
        if s.count(',') == 1:
            # Heuristic: if comma is followed by exactly 2 digits, it's likely a decimal
            parts = s.split(',')
            if len(parts[-1]) == 2:
                s = s.replace(',', '.')
            else:
                s = s.replace(',', '')
        else:
            # Multiple commas, e.g., 1,000,000
            s = s.replace(',', '')
    elif '.' in s:
        # Multiple dots, e.g., 1.000.000
        if s.count('.') > 1:
            s = s.replace('.', '')
        # Single dot scenario: if single dot is followed by exactly 3 digits, it MIGHT be a thousands separator
        # but in most banking CSVs, a single dot is a decimal. 
        # However, if it's 1.000 (exactly 3 digits), it's ambiguous.
        # We'll assume dot is decimal unless there are multiple.
            
    try:
        return float(s)
    except ValueError:
        # Final fallback: strip everything except digits, dots and minus
        s_fixed = "".join(c for c in s if c.isdigit() or c == '-' or c == '.')
        try:
            return float(s_fixed)
        except:
            return 0.0

def parse_csv_with_profile(content: bytes, profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    df = pd.read_csv(
        io.BytesIO(content), 
        delimiter=profile.get('delimiter', ','),
        skiprows=profile.get('header_row', 0),
        encoding='utf-8-sig'
    )
    
    mapping = profile['column_mapping']
    date_col = mapping.get('date')
    amount_col = mapping.get('amount')
    credit_col = mapping.get('credit')
    debit_col = mapping.get('debit')
    amount_type_col = mapping.get('amount_type')
    account_col = mapping.get('account')
    invert_amount = mapping.get('invert_amount', False)
    
    # Description can be a single string or a list of strings
    desc_cols = mapping.get('description')
    if isinstance(desc_cols, str):
        desc_cols = [desc_cols]
    
    date_format = profile.get('date_format', '%Y-%m-%d')
    
    transactions = []
    for i, row in df.iterrows():
        try:
            # 1. Parse Date
            if date_col not in row or pd.isna(row[date_col]):
                continue
            raw_date = str(row[date_col]).strip()
            # Try flexible parsing first, then fallback to explicit format
            try:
                dt = pd.to_datetime(raw_date).date()
            except:
                dt = datetime.strptime(raw_date, date_format).date()
            
            # 2. Parse Amount
            amount = 0.0
            if amount_col and amount_col in row:
                raw_val = row[amount_col]
                amount = clean_amount(raw_val)
                print(f"DEBUG: Row {i}, Col '{amount_col}', Raw='{raw_val}', Cleaned={amount}")
                
                # Handle indicator column if present
                if amount_type_col and amount_type_col in row:
                    indicator = str(row[amount_type_col]).upper().strip()
                    
                    # Indicators might be comma-separated strings from frontend
                    credit_indicators = mapping.get('credit_indicators', ['C', 'CR', 'CREDIT'])
                    if isinstance(credit_indicators, str):
                        credit_indicators = [s.strip().upper() for s in credit_indicators.split(',')]
                    else:
                        credit_indicators = [str(s).upper() for s in credit_indicators]
                        
                    debit_indicators = mapping.get('debit_indicators', ['D', 'DR', 'DEBIT'])
                    if isinstance(debit_indicators, str):
                        debit_indicators = [s.strip().upper() for s in debit_indicators.split(',')]
                    else:
                        debit_indicators = [str(s).upper() for s in debit_indicators]
                    
                    if indicator in debit_indicators:
                        amount = -abs(amount)
                    elif indicator in credit_indicators:
                        amount = abs(amount)
                    print(f"DEBUG: Row {i}, Indicator Column '{amount_type_col}', Key='{indicator}', Final Amount={amount}")
                
                if invert_amount:
                    amount = -amount
                    print(f"DEBUG: Row {i}, Invert Amount active, Final Amount={amount}")
                    
            elif credit_col or debit_col:
                credit_val = 0.0
                debit_val = 0.0
                if credit_col and credit_col in row and not pd.isna(row[credit_col]):
                    credit_val = abs(clean_amount(row[credit_col]))
                if debit_col and debit_col in row and not pd.isna(row[debit_col]):
                    debit_val = abs(clean_amount(row[debit_col]))
                
                amount = credit_val - debit_val
                
                if invert_amount:
                    amount = -amount
                    
                print(f"DEBUG: Row {i}, Dual Amount (Credit={row.get(credit_col)}, Debit={row.get(debit_col)}), Final={amount}")
            
            # 3. Parse Description (Combine multiple fields)
            desc_parts = []
            for col in desc_cols:
                if col in row and not pd.isna(row[col]):
                    desc_parts.append(str(row[col]).strip())
            description = " | ".join(desc_parts)
            
            # 4. Parse Account String (if mapped)
            account_string = None
            if account_col and account_col in row and not pd.isna(row[account_col]):
                account_string = str(row[account_col]).strip()
            
            transactions.append({
                "date": dt,
                "amount": amount,
                "description": description,
                "account_string": account_string,
                "raw_data": row.to_dict()
            })
        except Exception as e:
            print(f"DEBUG: Error parsing row {i}: {e}")
            continue
            
    return transactions
