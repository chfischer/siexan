import re
import pandas as pd
from typing import Dict, List, Optional, Any, Union
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline


def parse_amount_condition(condition: str):
    """
    Parse an amount condition string like '>100', '<=500', '=50', '!=0'.
    Returns (operator_func, value) or None if invalid.
    """
    if not condition or not condition.strip():
        return None
    condition = condition.strip()
    # Order matters: check two-char operators first
    for op_str, op_func in [
        ('>=', lambda a, v: a >= v),
        ('<=', lambda a, v: a <= v),
        ('!=', lambda a, v: a != v),
        ('>', lambda a, v: a > v),
        ('<', lambda a, v: a < v),
        ('=', lambda a, v: a == v),
    ]:
        if condition.startswith(op_str):
            try:
                value = float(condition[len(op_str):].strip())
                return lambda a, v=value, f=op_func: f(a, v)
            except ValueError:
                return None
    return None


class TransactionCategorizer:
    def __init__(self):
        # Layer 1: Deterministic (Exact Mapping)
        self.exact_matches: Dict[str, str] = {}

        # Layer 2: Heuristic (Regex Patterns)
        self.regex_patterns: List[Dict[str, Any]] = []

        # Layer 3: Probabilistic (ML Pipeline)
        self.ml_pipeline: Optional[Pipeline] = None
        self.is_trained = False

    def add_exact_match(self, description: str, category: str):
        """Add an exact string match rule."""
        self.exact_matches[description.strip().lower()] = category

    def add_regex_pattern(self, pattern: str, category: str, amount_condition: str = None):
        """Add a regex pattern match rule with optional amount condition."""
        self.regex_patterns.append({
            "pattern": re.compile(pattern, re.IGNORECASE),
            "category": category,
            "raw_pattern": pattern,
            "amount_check": parse_amount_condition(amount_condition),
        })

    def train(self, data: Union[str, pd.DataFrame]):
        """
        Train the probabilistic layer.
        Accepts a path to a CSV or a pandas DataFrame.
        Expected columns: 'description', 'category'
        """
        if isinstance(data, str):
            df = pd.read_csv(data)
        else:
            df = data

        if df.empty or 'description' not in df.columns or 'category' not in df.columns:
            return

        # Filter out rows with missing data
        df = df.dropna(subset=['description', 'category'])

        if len(df) < 2:
            return

        # Build TF-IDF + Naive Bayes pipeline
        self.ml_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(ngram_range=(1, 2), stop_words='english')),
            ('clf', MultinomialNB())
        ])

        self.ml_pipeline.fit(df['description'], df['category'])
        self.is_trained = True

    def categorize(self, description: str, amount: float = None) -> Dict[str, Any]:
        """
        Main waterfall categorization logic:
        1. Exact Match
        2. Regex Match (with optional amount condition)
        3. ML Probabilistic
        """
        if not description:
            return {"category": "Uncategorized", "source": "none", "confidence": 0.0}

        desc_clean = description.strip().lower()

        # Layer 1: Deterministic (O(1))
        if desc_clean in self.exact_matches:
            return {
                "category": self.exact_matches[desc_clean],
                "source": "exact",
                "confidence": 1.0
            }

        # Layer 2: Heuristic (Regex)
        for entry in self.regex_patterns:
            # Skip label rules in the main categorization waterfall
            if entry["category"].startswith("__ID_LABEL__:"):
                continue

            if entry["pattern"].search(description):
                # Check amount condition if present
                if entry["amount_check"] and amount is not None:
                    if not entry["amount_check"](amount):
                        continue
                elif entry["amount_check"] and amount is None:
                    # Rule requires amount check but no amount provided — skip
                    continue

                return {
                    "category": entry["category"],
                    "source": "regex",
                    "confidence": 0.9
                }

        # Layer 3: Probabilistic (ML)
        if self.is_trained and self.ml_pipeline:
            # Predict
            probs = self.ml_pipeline.predict_proba([description])[0]
            max_prob_idx = np.argmax(probs)
            category = self.ml_pipeline.classes_[max_prob_idx]
            confidence = float(probs[max_prob_idx])

            # Threshold for confidence
            if confidence > 0.7:  # Increased threshold for better accuracy
                return {
                    "category": str(category),
                    "source": "ml",
                    "confidence": confidence
                }

        return {
            "category": "Uncategorized",
            "source": "none",
            "confidence": 0.0
        }

    def get_labels(self, description: str, amount: float = None) -> List[str]:
        """
        Scan all regex patterns to find matching labels.
        """
        if not description:
            return []

        matched_labels = []
        for entry in self.regex_patterns:
            if entry["category"].startswith("__ID_LABEL__:") and entry["pattern"].search(description):
                # Check amount condition if present
                if entry["amount_check"] and amount is not None:
                    if not entry["amount_check"](amount):
                        continue
                elif entry["amount_check"] and amount is None:
                    continue

                label_info = entry["category"].replace("__ID_LABEL__:", "")
                if label_info not in matched_labels:
                    matched_labels.append(label_info)

        return matched_labels
