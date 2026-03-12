from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

import os

from .config import get_db_path

def get_engine(db_path=None):
    path = db_path or get_db_path()
    if not path:
        # Return a dummy memory engine to avoid crashes on startup
        return create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    return create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})

_current_db_path = get_db_path()
engine = get_engine(_current_db_path)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def init_db_schema(target_engine):
    from sqlalchemy import text
    Base.metadata.create_all(bind=target_engine)
    try:
        with target_engine.connect() as conn:
            # Check if column exists
            result = conn.execute(text("PRAGMA table_info(transactions)"))
            columns = [row[1] for row in result]
            if "is_manual" not in columns:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN is_manual INTEGER DEFAULT 0"))
            if "comment" not in columns:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN comment TEXT"))

            result_acc = conn.execute(text("PRAGMA table_info(accounts)"))
            columns_acc = [row[1] for row in result_acc]
            if "currency" not in columns_acc:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'CHF'"))
            
            result_cat = conn.execute(text("PRAGMA table_info(categories)"))
            columns_cat = [row[1] for row in result_cat]
            if "target_account_id" not in columns_cat:
                conn.execute(text("ALTER TABLE categories ADD COLUMN target_account_id INTEGER REFERENCES accounts(id)"))
            
            try:
                conn.execute(text("DROP INDEX IF EXISTS ix_categories_name"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uix_category_name_parent ON categories (name, parent_id)"))
                conn.commit()
            except Exception:
                pass

            result_rule = conn.execute(text("PRAGMA table_info(categorization_rules)"))
            columns_rule = [row[1] for row in result_rule]
            if "priority" not in columns_rule:
                conn.execute(text("ALTER TABLE categorization_rules ADD COLUMN priority INTEGER DEFAULT 0"))
            if "amount_condition" not in columns_rule:
                conn.execute(text("ALTER TABLE categorization_rules ADD COLUMN amount_condition TEXT"))
            
            conn.commit()
    except Exception as e:
        print(f"DEBUG: Migration failed or column exists: {e}")

def get_db():
    global engine, SessionLocal, _current_db_path
    
    current_path = get_db_path()
    if not current_path:
        raise HTTPException(status_code=400, detail="No database selected. Please create or select a database first.")
    
    # If the database path changed, recreate the engine and sessionmaker
    if current_path != _current_db_path:
        print(f"DEBUG: Database changed from {_current_db_path} to {current_path}. Reinitializing engine.")
        engine.dispose()
        _current_db_path = current_path
        engine = get_engine(_current_db_path)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Ensure tables and migrations are run on the new database
        init_db_schema(engine)
        
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
