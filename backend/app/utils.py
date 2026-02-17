import pandas as pd
import io
from typing import Dict, Any, List
from datetime import datetime

def parse_csv_with_profile(content: bytes, profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parses CSV content based on a CSVProfile column mapping.
    profile['column_mapping'] structure: 
    {
        "date": "CSV_Column_Name",
        "amount": "CSV_Column_Name",
        "description": "CSV_Column_Name",
        "optional_fields": ["Other_Column"]
    }
    """
    df = pd.read_csv(
        io.BytesIO(content), 
        delimiter=profile.get('delimiter', ','),
        skiprows=profile.get('header_row', 0),
        encoding='utf-8-sig'
    )
    print(f"DEBUG: DataFrame has {len(df)} rows after reading CSV with header={profile.get('header_row', 0)}")
    
    mapping = profile['column_mapping']
    date_col = mapping.get('date')
    amount_col = mapping.get('amount')
    credit_col = mapping.get('credit')
    debit_col = mapping.get('debit')
    
    # Description can be a single string or a list of strings
    desc_cols = mapping.get('description')
    if isinstance(desc_cols, str):
        desc_cols = [desc_cols]
    
    date_format = profile.get('date_format', '%Y-%m-%d')
    
    print(f"DEBUG: Using columns: date={date_col}, amount={amount_col}, credit={credit_col}, debit={debit_col}, desc={desc_cols}")
    print(f"DEBUG: Actual DataFrame columns: {list(df.columns)}")

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
            
            # 2. Parse Amount (Dual or Single)
            amount = 0.0
            if amount_col and amount_col in row:
                amount = float(str(row[amount_col]).replace(',', ''))
            elif credit_col or debit_col:
                credit = 0.0
                debit = 0.0
                if credit_col and credit_col in row and not pd.isna(row[credit_col]):
                    credit = float(str(row[credit_col]).replace(',', ''))
                if debit_col and debit_col in row and not pd.isna(row[debit_col]):
                    debit = float(str(row[debit_col]).replace(',', ''))
                amount = credit - debit
            
            # 3. Parse Description (Combine multiple fields)
            desc_parts = []
            for col in desc_cols:
                if col in row and not pd.isna(row[col]):
                    desc_parts.append(str(row[col]).strip())
            description = " | ".join(desc_parts)
            
            transactions.append({
                "date": dt,
                "amount": amount,
                "description": description,
                "raw_data": row.to_dict()
            })
        except Exception as e:
            print(f"DEBUG: Error parsing row {i}: {e}")
            continue
            
    return transactions
