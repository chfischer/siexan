from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

import os

from .config import get_db_path

def get_engine():
    db_path = get_db_path()
    if not db_path:
        # Return a dummy memory engine to avoid crashes on startup
        return create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    return create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    if not get_db_path():
        raise HTTPException(status_code=400, detail="No database selected. Please create or select a database first.")
    
    # We need to recreate the sessionmaker/engine if the config changed
    # For now, let's just use the current engine. 
    # Switching DBs triggers an app reload in main.py, so this is fine.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
