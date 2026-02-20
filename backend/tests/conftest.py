import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app import models # Important for Base.metadata to discover tables

from sqlalchemy.pool import StaticPool

# Use an in-memory SQLite database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db():
    # Create the database schema
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop the schema after the test
        Base.metadata.drop_all(bind=engine)

@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass # DB connection closed in db fixture

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    # Clear overrides after the test
    app.dependency_overrides.clear()
