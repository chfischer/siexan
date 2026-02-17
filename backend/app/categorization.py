from sqlalchemy.orm import Session
from . import models
from .services.categorizer import TransactionCategorizer
import re
import os

# Singleton instance for high performance
_categorizer = None

def sync_rules(db: Session):
    """
    Reloads all rules from the database into the singleton categorizer instance.
    Returns a list of patterns that failed to load.
    """
    global _categorizer
    _categorizer = None
    categorizer = get_categorizer(db)
    return getattr(categorizer, "_failed_rules", [])

def get_categorizer(db: Session = None):
    global _categorizer
    if _categorizer is None:
        print("DEBUG: Initializing Waterfall Categorizer...")
        _categorizer = TransactionCategorizer()
        _categorizer._failed_rules = []
        if db:
            rules = db.query(models.CategorizationRule).all()
            for rule in rules:
                try:
                    target_name = "Uncategorized"
                    if rule.target_account_id:
                        # Use ID-based string for reliable lookup later
                        target_name = f"__ID_TRANSFER__:{rule.target_account_id}"
                    elif rule.target_label_id:
                        target_name = f"__ID_LABEL__:{rule.target_label_id}"
                    elif rule.target_category_id:
                        target_name = f"__ID_CAT__:{rule.target_category_id}"
                    
                    _categorizer.add_regex_pattern(rule.pattern, target_name)
                except Exception as e:
                    _categorizer._failed_rules.append({"pattern": rule.pattern, "error": str(e)})
    return _categorizer

def categorize_transaction(db: Session, transaction: models.Transaction):
    categorizer = get_categorizer(db)
    result = categorizer.categorize(transaction.description)
    
    cat_str = result["category"]
    
    if cat_str != "Uncategorized":
        if cat_str.startswith("__ID_TRANSFER__:"):
            acc_id = int(cat_str.replace("__ID_TRANSFER__:", ""))
            transaction.is_transfer = 1
            transaction.to_account_id = acc_id
            transaction.category_id = None
        elif cat_str.startswith("__ID_CAT__:"):
            cat_id = int(cat_str.replace("__ID_CAT__:", ""))
            transaction.category_id = cat_id
            transaction.is_transfer = 0
            transaction.to_account_id = None
    
    # Layer 2: Labeling
    labels_matched = categorizer.get_labels(transaction.description)
    if labels_matched:
        for lbl_id_str in labels_matched:
            lbl_id = int(lbl_id_str)
            lbl = db.query(models.Label).filter(models.Label.id == lbl_id).first()
            if lbl and lbl not in transaction.labels:
                transaction.labels.append(lbl)

    return result["category"] != "Uncategorized"

def recategorize_all(db: Session):
    """
    Finds all transactions and re-applies rules (categorization + labels).
    """
    failed_rules = sync_rules(db)
    transactions = db.query(models.Transaction).all()
    count = 0
    for t in transactions:
        if categorize_transaction(db, t):
            count += 1
    db.commit()
    return count, failed_rules

# Placeholder for AI/ML training call
def train_categorizer(db: Session, csv_path: str):
    categorizer = get_categorizer(db)
    categorizer.train(csv_path)
