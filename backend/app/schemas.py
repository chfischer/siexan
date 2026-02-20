from pydantic import BaseModel
from datetime import date
from typing import List, Optional, Dict, Any

class LabelBase(BaseModel):
    name: str
    color: str = "#6366f1"

class LabelCreate(LabelBase):
    pass

class Label(LabelBase):
    id: int
    class Config:
        from_attributes = True

class AccountBase(BaseModel):
    name: str
    type: str

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: int
    class Config:
        from_attributes = True

class CategoryBase(BaseModel):
    name: str
    parent_id: Optional[int] = None
    target_account_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    date: date
    description: str
    amount: float
    account_id: int
    category_id: Optional[int] = None
    is_transfer: bool = False
    to_account_id: Optional[int] = None
    raw_data: Optional[Dict[str, Any]] = None
    is_manual: bool = False

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int
    category: Optional[Category] = None
    to_account: Optional[Account] = None
    labels: List[Label] = []
    class Config:
        from_attributes = True

class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    is_transfer: Optional[bool] = None
    to_account_id: Optional[int] = None
    is_manual: Optional[bool] = None

class CSVProfileBase(BaseModel):
    name: str
    column_mapping: Dict[str, Any]
    date_format: str = "%Y-%m-%d"
    delimiter: str = ","
    header_row: int = 0

class CSVProfileCreate(CSVProfileBase):
    pass

class CSVProfile(CSVProfileBase):
    id: int
    class Config:
        from_attributes = True

class CategorizationRuleBase(BaseModel):
    pattern: str
    priority: int = 0
    target_category_id: Optional[int] = None
    target_account_id: Optional[int] = None
    target_label_id: Optional[int] = None

class CategorizationRuleCreate(CategorizationRuleBase):
    pass

class CategorizationRuleUpdate(BaseModel):
    pattern: Optional[str] = None
    priority: Optional[int] = None
    target_category_id: Optional[int] = None
    target_account_id: Optional[int] = None
    target_label_id: Optional[int] = None

class CategorizationRule(CategorizationRuleBase):
    id: int
    category: Optional[Category] = None
    target_account: Optional[Account] = None
    target_label: Optional[Label] = None
    class Config:
        from_attributes = True
