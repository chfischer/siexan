from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, JSON, Table
from sqlalchemy.orm import relationship
from .database import Base

# Association table for Transaction <-> Label
transaction_labels = Table(
    "transaction_labels",
    Base.metadata,
    Column("transaction_id", Integer, ForeignKey("transactions.id"), primary_key=True),
    Column("label_id", Integer, ForeignKey("labels.id"), primary_key=True)
)

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    children = relationship("Category")
    transactions = relationship("Transaction", back_populates="category")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    description = Column(String)
    amount = Column(Float)
    raw_data = Column(JSON)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    is_transfer = Column(Integer, default=0) # 0 = False, 1 = True (SQLite compatibility)
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    transaction_hash = Column(String, unique=True, index=True, nullable=True)
    is_manual = Column(Integer, default=0) # 0 = Auto/Uncategorized, 1 = User set

    category = relationship("Category", back_populates="transactions")
    account = relationship("Account", foreign_keys=[account_id], back_populates="transactions")
    to_account = relationship("Account", foreign_keys=[to_account_id])
    labels = relationship("Label", secondary=transaction_labels, back_populates="transactions")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    type = Column(String) # e.g., "Checking", "Credit Card"

    transactions = relationship("Transaction", back_populates="account", foreign_keys="[Transaction.account_id]")

class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    color = Column(String, default="#6366f1")

    transactions = relationship("Transaction", secondary=transaction_labels, back_populates="labels")

class CSVProfile(Base):
    __tablename__ = "csv_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    column_mapping = Column(JSON) # e.g., {"date": "Transaction Date", "amount": "Value", ...}
    date_format = Column(String, default="%Y-%m-%d")
    delimiter = Column(String, default=",")
    header_row = Column(Integer, default=0) # 0-indexed row for headers

class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id = Column(Integer, primary_key=True, index=True)
    pattern = Column(String, index=True) # regex pattern to match description
    target_category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    target_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    target_label_id = Column(Integer, ForeignKey("labels.id"), nullable=True)

    category = relationship("Category")
    target_account = relationship("Account")
    target_label = relationship("Label")
