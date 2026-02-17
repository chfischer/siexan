import re
import pandas as pd
from typing import Dict, List, Optional, Any, Union
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

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

    def add_regex_pattern(self, pattern: str, category: str):
        """Add a regex pattern match rule."""
        self.regex_patterns.append({
            "pattern": re.compile(pattern, re.IGNORECASE),
            "category": category,
            "raw_pattern": pattern
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

    def categorize(self, description: str) -> Dict[str, Any]:
        """
        Main waterfall categorization logic:
        1. Exact Match
        2. Regex Match
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
            if entry["pattern"].search(description):
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

    def get_labels(self, description: str) -> List[str]:
        """
        Scan all regex patterns to find matching labels.
        Labels follow the format "Label:Name" in our internal rule representation.
        """
        if not description:
            return []
            
        matched_labels = []
        for entry in self.regex_patterns:
            if entry["category"].startswith("__ID_LABEL__:") and entry["pattern"].search(description):
                label_info = entry["category"].replace("__ID_LABEL__:", "")
                if label_info not in matched_labels:
                    matched_labels.append(label_info)
        
        return matched_labels
