import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Body, APIRouter, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io

from . import models, schemas, categorization, seed
from .database import SessionLocal, engine, get_db, Base
from .config import get_config, save_config, get_db_path, DATA_DIR

# Ensure tables exist on startup only if a DB is selected
if get_db_path():
    Base.metadata.create_all(bind=engine)

    # Migration: Add is_manual column to transactions if it doesn't exist
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # Check if column exists
            result = conn.execute(text("PRAGMA table_info(transactions)"))
            columns = [row[1] for row in result]
            if "is_manual" not in columns:
                print("DEBUG: Migration - Adding is_manual column to transactions table")
                conn.execute(text("ALTER TABLE transactions ADD COLUMN is_manual INTEGER DEFAULT 0"))
            
            result_cat = conn.execute(text("PRAGMA table_info(categories)"))
            columns_cat = [row[1] for row in result_cat]
            if "target_account_id" not in columns_cat:
                print("DEBUG: Migration - Adding target_account_id to categories table")
                conn.execute(text("ALTER TABLE categories ADD COLUMN target_account_id INTEGER REFERENCES accounts(id)"))
            
            # Migration: Update categories unique constraint
            try:
                # 1. Drop old global unique index if it exists
                conn.execute(text("DROP INDEX IF EXISTS ix_categories_name"))
                # 2. Create new per-parent unique index
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uix_category_name_parent ON categories (name, parent_id)"))
                print("DEBUG: Migration - Updated categories unique constraint to (name, parent_id)")
                conn.commit()
            except Exception as ex:
                print(f"DEBUG: Category uniqueness migration note: {ex}")
                conn.rollback()

            result_rule = conn.execute(text("PRAGMA table_info(categorization_rules)"))
            columns_rule = [row[1] for row in result_rule]
            if "priority" not in columns_rule:
                print("DEBUG: Migration - Adding priority to categorization_rules table")
                conn.execute(text("ALTER TABLE categorization_rules ADD COLUMN priority INTEGER DEFAULT 0"))
            
            conn.commit()
    except Exception as e:
        print(f"DEBUG: Migration failed or column exists: {e}")

def sync_transfer_categories(db: Session):
    """Ensures a 'Transfer' parent category exists and has sub-categories for each account."""
    # 1. Ensure 'Transfer' parent exists
    transfer_parent = db.query(models.Category).filter(models.Category.name == "Transfer", models.Category.parent_id == None).first()
    if not transfer_parent:
        transfer_parent = models.Category(name="Transfer")
        db.add(transfer_parent)
        db.commit()
        db.refresh(transfer_parent)
    
    # 2. Sync sub-categories for each account
    accounts = db.query(models.Account).all()
    for acc in accounts:
        # Check if sub-category exists for this account
        existing = db.query(models.Category).filter(
            models.Category.parent_id == transfer_parent.id,
            models.Category.target_account_id == acc.id
        ).first()
        
        if not existing:
            # Create sub-category
            # Note: We use a specific name pattern, e.g., "-> Savings"
            cat_name = f"↳ {acc.name}"
            sub_cat = models.Category(name=cat_name, parent_id=transfer_parent.id, target_account_id=acc.id)
            db.add(sub_cat)
            print(f"DEBUG: Created transfer category for account {acc.name}")
    
    db.commit()

app = FastAPI(title="siexan - Simple Expense Analyser")

@app.middleware("http")
async def strip_api_prefix(request: Request, call_next):
    # If the path starts with /api/, strip it so it matches our routes
    if request.url.path.startswith("/api/"):
        scope = request.scope
        original_path = scope["path"]
        # /api/something -> /something
        scope["path"] = original_path[4:]
        
    return await call_next(request)

# --- Database Management Endpoints ---

@app.get("/databases/")
def list_databases():
    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".db")]
    current = get_config().get("current_db", "")
    return {"databases": files, "current": current}

@app.get("/filesystem/list")
def list_filesystem(path: Optional[str] = None):
    if not path:
        path = os.path.expanduser("~")
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Path not found")
        
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="Path is not a directory")
        
    try:
        items = []
        for item in os.listdir(path):
            if item.startswith('.'):
                continue
            full_path = os.path.join(path, item)
            is_dir = os.path.isdir(full_path)
            if not is_dir and not item.endswith('.db'):
                continue
            items.append({
                "name": item,
                "path": full_path,
                "is_dir": is_dir
            })
        
        # Sort: directories first, then files
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        
        return {
            "path": path,
            "parent": os.path.dirname(path) if path != "/" else None,
            "items": items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/databases/select")
def select_database(db_name: str, create_if_missing: bool = False):
    # db_name can now be an absolute path
    if os.path.isabs(db_name):
        db_path = db_name
    else:
        db_path = os.path.join(DATA_DIR, db_name)
        
    if not db_name.endswith(".db"):
        raise HTTPException(status_code=400, detail="Database must end in .db")
    
    if not create_if_missing and not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
    
    config = get_config()
    config["current_db"] = db_name
    save_config(config)
    
    # Force a reload of the app by touching main.py if we were in production, 
    # but uvicorn --reload won't see config.json. 
    # We can try to touch this file to trigger a reload.
    os.utime(__file__, None)
    
    return {"message": f"Database switched to {db_name}. App is reloading..."}

@app.post("/databases/create")
def create_database(db_name: str):
    if not db_name.endswith(".db"):
        db_name += ".db"
        
    db_path = os.path.join(DATA_DIR, db_name)
    
    if os.path.exists(db_path):
        raise HTTPException(status_code=400, detail="Database already exists")
    
    # Selecting it with create_if_missing=True will trigger schema creation on reload
    return select_database(db_name, create_if_missing=True)

@app.post("/seed/")
def run_seed(db: Session = Depends(get_db)):
    seed.seed_db(db)
    return {"message": "Database seeded successfully"}

@app.post("/databases/populate")
def populate_example(db: Session = Depends(get_db)):
    import generate_example
    try:
        count = generate_example.populate_example_data(db)
        return {"message": f"Successfully populated {count} example transactions."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to populate example data: {str(e)}")

@app.get("/")
async def read_root():
    # If we are in consolidated mode (Docker or local build), serve the frontend
    # Otherwise, return a simple API message
    frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Welcome to the Expense Analysis API (Backend Only)"}

# --- CSV Profile Endpoints ---

@app.post("/profiles/", response_model=schemas.CSVProfile)
def create_profile(profile: schemas.CSVProfileCreate, db: Session = Depends(get_db)):
    db_profile = models.CSVProfile(**profile.dict())
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile

@app.get("/profiles/", response_model=List[schemas.CSVProfile])
def read_profiles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    profiles = db.query(models.CSVProfile).offset(skip).limit(limit).all()
    return profiles

@app.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    db_profile = db.query(models.CSVProfile).filter(models.CSVProfile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(db_profile)
    db.commit()
    return {"message": "Profile deleted"}

@app.put("/profiles/{profile_id}", response_model=schemas.CSVProfile)
def update_profile(profile_id: int, profile: schemas.CSVProfileCreate, db: Session = Depends(get_db)):
    db_profile = db.query(models.CSVProfile).filter(models.CSVProfile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    for key, value in profile.dict().items():
        setattr(db_profile, key, value)
        
    db.commit()
    db.refresh(db_profile)
    return db_profile

# --- Account Endpoints ---

@app.post("/accounts/", response_model=schemas.Account)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db)):
    db_account = models.Account(**account.dict())
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    sync_transfer_categories(db)
    return db_account

@app.get("/accounts/", response_model=List[schemas.Account])
def read_accounts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sync_transfer_categories(db)
    accounts = db.query(models.Account).offset(skip).limit(limit).all()
    return accounts

# --- Category Endpoints ---

@app.post("/categories/", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    # Support hierarchical names via slash notation (e.g., "Salary/Anna")
    parts = [p.strip() for p in category.name.split('/')]
    
    current_parent_id = None
    last_cat = None
    
    for part in parts:
        # Check if category exists at this level
        existing = db.query(models.Category).filter(
            models.Category.name == part,
            models.Category.parent_id == current_parent_id
        ).first()
        
        if existing:
            last_cat = existing
        else:
            # Create new category
            new_cat = models.Category(name=part, parent_id=current_parent_id)
            db.add(new_cat)
            db.commit()
            db.refresh(new_cat)
            last_cat = new_cat
            
        current_parent_id = last_cat.id
        
    return last_cat

@app.get("/categories/", response_model=List[schemas.Category])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sync_transfer_categories(db)
    categories = db.query(models.Category).all()
    return categories

# --- Categorization Rules ---

@app.post("/rules/")
def create_rule(rule: schemas.CategorizationRuleCreate, db: Session = Depends(get_db)):
    db_rule = models.CategorizationRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    # Reload rules in memory
    from .categorization import sync_rules
    sync_rules(db)
    
    # Auto-trigger categorization
    from .categorization import recategorize_all
    matches, changes, _ = recategorize_all(db)
    
    return {
        "rule": db_rule,
        "matches": matches,
        "changes": changes
    }

@app.get("/rules/", response_model=List[schemas.CategorizationRule])
def read_rules(db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    return db.query(models.CategorizationRule).options(
        joinedload(models.CategorizationRule.category),
        joinedload(models.CategorizationRule.target_account),
        joinedload(models.CategorizationRule.target_label)
    ).order_by(models.CategorizationRule.priority.asc()).all()

@app.put("/rules/{rule_id}")
def update_rule(rule_id: int, rule_update: schemas.CategorizationRuleUpdate, db: Session = Depends(get_db)):
    db_rule = db.query(models.CategorizationRule).filter(models.CategorizationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    update_data = rule_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rule, key, value)
    
    db.commit()
    db.refresh(db_rule)
    
    # Reload rules in memory
    from .categorization import sync_rules
    sync_rules(db)
    
    # Auto-trigger categorization
    from .categorization import recategorize_all
    matches, changes, _ = recategorize_all(db)
    
    return {
        "rule": db_rule,
        "matches": matches,
        "changes": changes
    }

@app.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(models.CategorizationRule).filter(models.CategorizationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    db.delete(db_rule)
    db.commit()

    # Reload rules in memory
    from .categorization import sync_rules
    sync_rules(db)
    
    # Auto-trigger categorization to reset transactions
    from .categorization import recategorize_all
    matches, changes, _ = recategorize_all(db)
    
    return {"message": "Rule deleted", "matches": matches, "changes": changes}

@app.post("/rules/re-categorize/")
def recategorize_transactions(db: Session = Depends(get_db)):
    from .categorization import recategorize_all
    try:
        matches, changes, failed_rules = recategorize_all(db)
        return {
            "message": f"Re-categorization complete! {changes} transactions were updated, {matches} patterns matched.",
            "count": changes,
            "matches": matches,
            "failed_rules": failed_rules
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Re-categorization failed: {str(e)}")

# --- Import/Export Endpoints ---

@app.get("/profiles/export/")
def export_profiles(db: Session = Depends(get_db)):
    profiles = db.query(models.CSVProfile).all()
    # Remove database IDs for export
    return [{k: v for k, v in p.__dict__.items() if k != '_sa_instance_state' and k != 'id'} for p in profiles]

@app.post("/profiles/import/")
def import_profiles(profiles_data: List[dict], db: Session = Depends(get_db)):
    imported = 0
    skipped = 0
    for data in profiles_data:
        existing = db.query(models.CSVProfile).filter(models.CSVProfile.name == data['name']).first()
        if existing:
            skipped += 1
            continue
        db_profile = models.CSVProfile(**data)
        db.add(db_profile)
        imported += 1
    db.commit()
    return {"message": f"Imported {imported} profiles, skipped {skipped} duplicates", "imported": imported, "skipped": skipped}

@app.get("/rules/export/")
def export_rules(db: Session = Depends(get_db)):
    rules = db.query(models.CategorizationRule).all()
    categories = db.query(models.Category).all()
    labels = db.query(models.Label).all()
    
    # Bundle names with rules
    exported_rules = []
    for r in rules:
        rule_dict = {
            "pattern": r.pattern,
            "target_category_name": r.category.name if r.category else None,
            "target_account_name": r.target_account.name if r.target_account else None,
            "target_label_name": r.target_label.name if r.target_label else None
        }
        exported_rules.append(rule_dict)
        
    return {
        "rules": exported_rules,
        "categories": [{"name": c.name} for c in categories],
        "labels": [{"name": l.name, "color": l.color} for l in labels]
    }

@app.post("/rules/import/")
def import_rules(data: dict, db: Session = Depends(get_db)):
    imported_cat = 0
    imported_lbl = 0
    imported_rule = 0
    skipped_rule = 0

    # 1. Categories
    for cat_data in data.get('categories', []):
        existing = db.query(models.Category).filter(models.Category.name == cat_data['name']).first()
        if not existing:
            db.add(models.Category(name=cat_data['name']))
            imported_cat += 1
    db.commit()

    # 2. Labels
    for lbl_data in data.get('labels', []):
        existing = db.query(models.Label).filter(models.Label.name == lbl_data['name']).first()
        if not existing:
            db.add(models.Label(name=lbl_data['name'], color=lbl_data.get('color', '#6366f1')))
            imported_lbl += 1
    db.commit()

    # 3. Rules
    for rule_data in data.get('rules', []):
        pattern = rule_data['pattern']
        
        # Resolve IDs
        cat_id = None
        if rule_data.get('target_category_name'):
            cat = db.query(models.Category).filter(models.Category.name == rule_data['target_category_name']).first()
            if cat: cat_id = cat.id
            
        acc_id = None
        if rule_data.get('target_account_name'):
            acc = db.query(models.Account).filter(models.Account.name == rule_data['target_account_name']).first()
            if acc: acc_id = acc.id

        lbl_id = None
        if rule_data.get('target_label_name'):
            lbl = db.query(models.Label).filter(models.Label.name == rule_data['target_label_name']).first()
            if lbl: lbl_id = lbl.id

        # Check for duplication
        existing = db.query(models.CategorizationRule).filter(
            models.CategorizationRule.pattern == pattern,
            models.CategorizationRule.target_category_id == cat_id,
            models.CategorizationRule.target_account_id == acc_id,
            models.CategorizationRule.target_label_id == lbl_id
        ).first()
        
        if existing:
            skipped_rule += 1
            continue
            
        db_rule = models.CategorizationRule(
            pattern=pattern,
            target_category_id=cat_id,
            target_account_id=acc_id,
            target_label_id=lbl_id
        )
        db.add(db_rule)
        imported_rule += 1
        
    db.commit()
    return {
        "message": f"Imported {imported_cat} categories, {imported_lbl} labels, and {imported_rule} rules. Skipped {skipped_rule} duplicate rules.",
        "imported_categories": imported_cat,
        "imported_labels": imported_lbl,
        "imported_rules": imported_rule,
        "skipped_rules": skipped_rule
    }

@app.post("/migrate-labels")
def run_migration_labels(db: Session = Depends(get_db)):
    try:
        from sqlalchemy import text
        # 1. Create labels table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#6366f1'
            )
        """))
        
        # 2. Create transaction_labels association table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS transaction_labels (
                transaction_id INTEGER,
                label_id INTEGER,
                PRIMARY KEY (transaction_id, label_id),
                FOREIGN KEY (transaction_id) REFERENCES transactions (id),
                FOREIGN KEY (label_id) REFERENCES labels (id)
            )
        """))
        
        # 3. Add target_label_id to categorization_rules
        try:
            db.execute(text("ALTER TABLE categorization_rules ADD COLUMN target_label_id INTEGER REFERENCES labels(id)"))
        except Exception:
            pass # Already exists
            
        db.commit()
        return {"message": "Migration successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/migrations/hashes")
def run_migration_hashes(db: Session = Depends(get_db)):
    import hashlib
    from sqlalchemy import text
    
    # 1. Ensure column exists
    try:
        db.execute(text("ALTER TABLE transactions ADD COLUMN transaction_hash TEXT"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Note: Could not add column (likely exists): {e}")

    # 2. Add unique index if possible
    try:
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_transactions_transaction_hash ON transactions (transaction_hash)"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Note: Could not create unique index: {e}")

    def calculate_hash(date_val, amount_val, desc_val, acc_id):
        # Deterministic string: Date|Amount|Description|AccountID
        data_str = f"{date_val}|{amount_val}|{desc_val}|{acc_id}"
        return hashlib.sha256(data_str.encode()).hexdigest()

    from sqlalchemy.exc import IntegrityError
    # Fetch transactions that don't have a hash yet
    transactions = db.query(models.Transaction).filter(models.Transaction.transaction_hash == None).all()
    count = 0
    duplicates = 0
    for t in transactions:
        tx_hash = calculate_hash(t.date, t.amount, t.description, t.account_id)
        t.transaction_hash = tx_hash
        try:
            # Check for conflict with existing hashes
            with db.begin_nested():
                db.flush()
            count += 1
        except IntegrityError:
            db.rollback()
            # If a duplicate is found during migration, remove it
            db.delete(t)
            duplicates += 1
            
    db.commit()
    return {"message": f"Populated hashes for {count} transactions, removed {duplicates} duplicates."}

# --- Label Endpoints ---

@app.post("/labels/", response_model=schemas.Label)
def create_label(label: schemas.LabelCreate, db: Session = Depends(get_db)):
    db_label = models.Label(**label.dict())
    db.add(db_label)
    db.commit()
    db.refresh(db_label)
    return db_label

@app.get("/labels/", response_model=List[schemas.Label])
def read_labels(db: Session = Depends(get_db)):
    try:
        return db.query(models.Label).all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/labels/{label_id}")
def delete_label(label_id: int, db: Session = Depends(get_db)):
    db_label = db.query(models.Label).filter(models.Label.id == label_id).first()
    if not db_label:
        raise HTTPException(status_code=404, detail="Label not found")
    db.delete(db_label)
    db.commit()
    return {"message": "Label deleted"}

# --- Transaction Endpoints ---

@app.get("/transactions/", response_model=List[schemas.Transaction])
def read_transactions(
    skip: int = 0, 
    limit: int = 100, 
    category_id: Optional[int] = None,
    is_uncategorized: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[int] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    db: Session = Depends(get_db)
):
    from sqlalchemy.orm import joinedload
    query = db.query(models.Transaction).options(
        joinedload(models.Transaction.category),
        joinedload(models.Transaction.to_account),
        joinedload(models.Transaction.labels)
    )
    
    if account_id is not None:
        query = query.filter(models.Transaction.account_id == account_id)
    if category_id is not None:
        query = query.filter(models.Transaction.category_id == category_id)
    if is_uncategorized:
        query = query.filter(models.Transaction.category_id == None, models.Transaction.is_transfer == 0)
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.date <= end_date)
    if min_amount is not None:
        query = query.filter(models.Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(models.Transaction.amount <= max_amount)
        
    transactions = query.order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()
    return transactions

@app.get("/transactions/stats")
def get_transaction_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query_total = db.query(models.Transaction)
    query_uncat = db.query(models.Transaction).filter(
        models.Transaction.category_id == None,
        models.Transaction.is_transfer == 0
    )
    
    if start_date:
        query_total = query_total.filter(models.Transaction.date >= start_date)
        query_uncat = query_uncat.filter(models.Transaction.date >= start_date)
    if end_date:
        query_total = query_total.filter(models.Transaction.date <= end_date)
        query_uncat = query_uncat.filter(models.Transaction.date <= end_date)
    if account_id is not None:
        query_total = query_total.filter(models.Transaction.account_id == account_id)
        query_uncat = query_uncat.filter(models.Transaction.account_id == account_id)
        
    return {
        "total": query_total.count(),
        "uncategorized": query_uncat.count()
    }

@app.patch("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: int, tx_update: schemas.TransactionUpdate, db: Session = Depends(get_db)):
    db_tx = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = tx_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tx, key, value)
    
    # If the user updated category, transfer status or specifically is_manual
    if "category_id" in update_data:
        db_tx.is_manual = 1
        # Automatic Transfer handling
        selected_cat_id = update_data["category_id"]
        if selected_cat_id:
            cat = db.query(models.Category).filter(models.Category.id == selected_cat_id).first()
            if cat and cat.target_account_id:
                db_tx.is_transfer = 1
                db_tx.to_account_id = cat.target_account_id
            else:
                db_tx.is_transfer = 0
                db_tx.to_account_id = None
        else:
            # Uncategorized
            db_tx.is_transfer = 0
            db_tx.to_account_id = None
            
    if "is_transfer" in update_data or "to_account_id" in update_data:
        db_tx.is_manual = 1
    
    db.commit()
    db.refresh(db_tx)
    return db_tx

@app.post("/upload-csv/")
async def upload_csv(
    account_id: int,
    profile_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    import hashlib
    def calculate_hash(date_val, amount_val, desc_val, acc_id):
        # Deterministic string: Date|Amount|Description|AccountID
        data_str = f"{date_val}|{amount_val}|{desc_val}|{acc_id}"
        return hashlib.sha256(data_str.encode()).hexdigest()

    # 1. Get Profile
    profile = db.query(models.CSVProfile).filter(models.CSVProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    # 2. Parse CSV
    from .utils import parse_csv_with_profile
    content = await file.read()
    try:
        parsed_transactions = parse_csv_with_profile(content, {
            "column_mapping": profile.column_mapping,
            "date_format": profile.date_format,
            "delimiter": profile.delimiter,
            "header_row": profile.header_row
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")
        
    # 3. Handle Account Mapping
    account_mapping = profile.column_mapping.get('account_mapping', {})
    
    # 4. Save Transactions with Deduplication
    from .categorization import categorize_transaction
    from sqlalchemy.exc import IntegrityError
    
    imported_count = 0
    skipped_count = 0
    skipped_duplicates = 0
    unmapped_accounts = set()
    is_multi_account = bool(profile.column_mapping.get('account'))
    
    for t in parsed_transactions:
        # Determine actual account for this row
        final_account_id = account_id
        if is_multi_account:
            acc_str = t.get('account_string')
            mapped_id = account_mapping.get(acc_str) if acc_str else None
            # Only exact mappings allowed when using multi-account explicit mappings
            if not mapped_id:
                unmapped_accounts.add(acc_str if acc_str else "Empty Account")
                skipped_count += 1
                continue
            final_account_id = int(mapped_id)
        else:
            # Single-account with optional override
            if t.get('account_string'):
                mapped_id = account_mapping.get(t['account_string'])
                if mapped_id:
                    final_account_id = int(mapped_id)
        
        tx_hash = calculate_hash(t['date'], t['amount'], t['description'], final_account_id)
        
        db_t = models.Transaction(
            date=t['date'],
            amount=t['amount'],
            description=t['description'],
            raw_data=t['raw_data'],
            account_id=final_account_id,
            transaction_hash=tx_hash
        )
        
        try:
            # We use a sub-transaction (savepoint) to catch IntegrityError without breaking the main transaction
            with db.begin_nested():
                db.add(db_t)
                categorize_transaction(db, db_t)
            imported_count += 1
        except IntegrityError:
            # Duplicate found via transaction_hash unique constraint
            skipped_duplicates += 1
            skipped_count += 1
            continue
        except Exception as e:
            print(f"ERROR: Unexpected error importing transaction: {e}")
            skipped_count += 1
            continue
            
    db.commit()
    
    if unmapped_accounts:
        unmapped_str = ", ".join([f"'{a}'" for a in unmapped_accounts])
        msg = f"Import complete: {imported_count} imported. Skipped {skipped_count} transactions.\n({len(unmapped_accounts)} unmapped accounts: {unmapped_str})"
    else:
        num_skipped = skipped_count
        msg = f"Import complete: {imported_count} imported. Skipped {num_skipped} duplicates/errors."
        if num_skipped == 0:
            msg = f"Import complete: {imported_count} imported successfully."
            
    return {
        "message": msg,
        "imported": imported_count,
        "skipped": skipped_count,
        "unmapped_accounts": list(unmapped_accounts)
    }

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    tx = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted successfully"}

@app.delete("/transactions/bulk/")
def bulk_delete_transactions(transaction_ids: List[int] = Body(...), db: Session = Depends(get_db)):
    db.query(models.Transaction).filter(models.Transaction.id.in_(transaction_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"{len(transaction_ids)} transactions deleted successfully"}

# --- Analytics Endpoints ---

@app.get("/analytics/monthly")
def get_monthly_analytics(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    # 1. Monthly income
    income_query = db.query(
        func.strftime('%Y-%m', models.Transaction.date).label("month"),
        func.sum(models.Transaction.amount).label("inflow")
    ).filter(
        models.Transaction.is_transfer == 0,
        models.Transaction.amount > 0
    ).group_by("month").all()
    
    # 2. Monthly spending
    spending_query = db.query(
        func.strftime('%Y-%m', models.Transaction.date).label("month"),
        func.sum(models.Transaction.amount).label("outflow")
    ).filter(
        models.Transaction.is_transfer == 0,
        models.Transaction.amount < 0
    ).group_by("month").all()
    
    # Merge results
    months = sorted(list(set([r[0] for r in income_query] + [r[0] for r in spending_query])))
    
    income_map = {r[0]: r[1] for r in income_query}
    spending_map = {r[0]: abs(r[1]) for r in spending_query}
    
    result = []
    for m in months:
        if not m: continue # Skip null months if any
        result.append({
            "month": m,
            "inflow": income_map.get(m, 0.0),
            "outflow": spending_map.get(m, 0.0)
        })
    
    return result

@app.get("/analytics/summary")
def get_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    
    # 1. Spending breakdown (Negative amounts)
    spending_query = db.query(
        models.Category.name,
        models.Category.id,
        func.sum(models.Transaction.amount).label("total")
    ).select_from(models.Transaction).join(
        models.Category, isouter=True
    ).filter(models.Transaction.is_transfer == 0, models.Transaction.amount < 0)
    
    # 2. Income breakdown (Positive amounts)
    income_categories_query = db.query(
        models.Category.name,
        models.Category.id,
        func.sum(models.Transaction.amount).label("total")
    ).select_from(models.Transaction).join(
        models.Category, isouter=True
    ).filter(models.Transaction.is_transfer == 0, models.Transaction.amount > 0)

    if start_date:
        spending_query = spending_query.filter(models.Transaction.date >= start_date)
        income_categories_query = income_categories_query.filter(models.Transaction.date >= start_date)
    if end_date:
        spending_query = spending_query.filter(models.Transaction.date <= end_date)
        income_categories_query = income_categories_query.filter(models.Transaction.date <= end_date)
        
    spending_summary = spending_query.group_by(models.Category.name, models.Category.id).all()
    income_categories_summary = income_categories_query.group_by(models.Category.name, models.Category.id).all()
    
    total_income = sum(s[2] for s in income_categories_summary if s[2]) or 0.0
    total_spending = sum(s[2] for s in spending_summary if s[2]) or 0.0
    
    return {
        "spending_categories": [
            {"category": s[0] or "Uncategorized", "category_id": s[1], "total": abs(s[2]) if s[2] else 0.0} 
            for s in spending_summary
        ],
        "income_categories": [
            {"category": s[0] or "Uncategorized", "category_id": s[1], "total": s[2] if s[2] else 0.0} 
            for s in income_categories_summary
        ],
        "total_income": total_income,
        "total_spending": abs(total_spending)
    }

# --- Static File Serving (for Docker) ---

# Try to serve static files from /app/frontend/dist if it exists
# We need to go up 3 levels from backend/app/main.py to reach /app
frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")

if os.path.exists(frontend_path):
    # Serve assets (js, css, etc)
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")
    
    # Catch-all for SPA: serve index.html for any path not handled by API
    @app.get("/{rest_of_path:path}")
    async def serve_spa(rest_of_path: str):
        # Don't intercept API calls if they fail (they should return 404 or other)
        # But since this is at the END, anything reaching here IS a 404 for API.
        # For SPA routes (like /transactions), we return index.html
        return FileResponse(os.path.join(frontend_path, "index.html"))
