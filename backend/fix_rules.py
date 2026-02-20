from app.database import SessionLocal
from app.models import CategorizationRule
from app.categorization import recategorize_all, sync_rules

def fix_rules_and_recategorize():
    db = SessionLocal()
    
    # 1. Delete rule 13 (empty rule that acts as catch-all "Uncategorized")
    r13 = db.query(CategorizationRule).filter(CategorizationRule.id == 13).first()
    if r13:
        print("Deleting Rule 13...")
        db.delete(r13)
        
    # 2. Fix rule 27 (remove newline)
    r27 = db.query(CategorizationRule).filter(CategorizationRule.id == 27).first()
    if r27:
        print("Fixing Rule 27 pipes and newline...")
        r27.pattern = r27.pattern.replace("\n", "").replace("|", "\|")
        
    # 3. Fix rule 28 (escape pipes)
    r28 = db.query(CategorizationRule).filter(CategorizationRule.id == 28).first()
    if r28:
        print("Fixing Rule 28 pipes...")
        r28.pattern = r28.pattern.replace("|", "\|")
        
    db.commit()
    
    print("Rules updated. Running recategorization...")
    sync_rules(db)
    matches, changes, failed = recategorize_all(db)
    
    print(f"Recategorization complete: {changes} transactions updated, {matches} patterns matched.")
    if failed:
        print(f"Failed rules during sync: {failed}")

if __name__ == "__main__":
    fix_rules_and_recategorize()
