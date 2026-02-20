import os
import sys
import random
import hashlib
from datetime import datetime, timedelta

# Ensure backend acts as the root of execution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app import models
from app.seed import seed_db

def populate_example_data(db: Session):
    # Seed standard categories, basic accounts, and rules
    seed_db(db)
    
    # Now let's grab the seeded data to attach transactions to
    checking = db.query(models.Account).filter(models.Account.name == "Main Checking Account").first()
    credit = db.query(models.Account).filter(models.Account.name == "Travel Credit Card").first()
    
    # Categories
    housing = db.query(models.Category).filter(models.Category.name == "Housing").first()
    groceries = db.query(models.Category).filter(models.Category.name == "Groceries").first()
    restaurants = db.query(models.Category).filter(models.Category.name == "Restaurants").first()
    fuel = db.query(models.Category).filter(models.Category.name == "Fuel").first()
    entertainment = db.query(models.Category).filter(models.Category.name == "Entertainment").first()
    shopping = db.query(models.Category).filter(models.Category.name == "Shopping").first()
    utilities = db.query(models.Category).filter(models.Category.name == "Utilities").first()

    # Generate Transactions for the last 6 months
    transactions = []
    start_date = datetime.now() - timedelta(days=180)
    
    # 1. Salary (Monthly, positive)
    for i in range(6):
        salary_date = start_date + timedelta(days=i*30 + 5) # 5th of each month
        
        # Calculate a deterministic hash matching the app's hash algorithm
        # Date|Amount|Description|AccountID
        tx_hash1 = hashlib.sha256(f"{salary_date.date()}|4500.0|ACME Corp Payroll|{checking.id}".encode()).hexdigest()
        
        t = models.Transaction(
            date=salary_date.date(),
            description="ACME Corp Payroll",
            amount=4500.00,
            account_id=checking.id,
            category_id=None, # Income might not have a category yet, or could be categorized
            is_manual=0,
            transaction_hash=tx_hash1
        )
        transactions.append(t)
        
        # Rent (Monthly, negative)
        rent_date = start_date + timedelta(days=i*30 + 1) # 1st of each month
        tx_hash2 = hashlib.sha256(f"{rent_date.date()}|-1500.0|Downtown Apartments Rent|{checking.id}".encode()).hexdigest()

        t2 = models.Transaction(
            date=rent_date.date(),
            description="Downtown Apartments Rent",
            amount=-1500.00,
            account_id=checking.id,
            category_id=housing.id,
            is_manual=1,
            transaction_hash=tx_hash2
        )
        transactions.append(t2)
        
        # Utilities (Monthly)
        util_date = start_date + timedelta(days=i*30 + 15)
        util_amt = round(random.uniform(-100, -150), 2)
        tx_hash3 = hashlib.sha256(f"{util_date.date()}|{util_amt}|City Water & Power|{checking.id}".encode()).hexdigest()
        
        t3 = models.Transaction(
            date=util_date.date(),
            description="City Water & Power",
            amount=util_amt,
            account_id=checking.id,
            category_id=utilities.id,
            is_manual=0,
            transaction_hash=tx_hash3
        )
        transactions.append(t3)

    # 2. Variable Expenses (Random days)
    vendors = [
        ("WHOLEFOODS", groceries, credit, -50, -150),
        ("SAFEWAY", groceries, credit, -30, -100),
        ("STARBUCKS", restaurants, credit, -4, -15),
        ("GORDON RAMSAY BURGER", restaurants, credit, -40, -90),
        ("SHELL", fuel, credit, -40, -80),
        ("UBER", fuel, credit, -15, -45),
        ("AMAZON", shopping, credit, -20, -200),
        ("NETFLIX", entertainment, credit, -15.99, -15.99),
        ("AMC THEATRES", entertainment, credit, -30, -60),
    ]
    
    for _ in range(150): # 150 random transactions
        random_days = random.randint(0, 180)
        t_date = start_date + timedelta(days=random_days)
        
        vendor, cat, acc, min_amt, max_amt = random.choice(vendors)
        amt = round(random.uniform(min_amt, max_amt), 2)
        
        # Simulate slight variations in description (e.g., POS codes)
        desc_suffix = " #" + str(random.randint(1000, 9999)) if random.random() > 0.5 else ""
        desc = vendor + desc_suffix
        
        tx_hash4 = hashlib.sha256(f"{t_date.date()}|{amt}|{desc}|{acc.id}".encode()).hexdigest()

        t = models.Transaction(
            date=t_date.date(),
            description=desc,
            amount=amt,
            account_id=acc.id,
            category_id=cat.id, # Pretend it was categorized
            is_manual=0,
            transaction_hash=tx_hash4
        )
        transactions.append(t)

    # 3. Credit Card Payments (Transfers)
    for i in range(6):
        pay_date = start_date + timedelta(days=i*30 + 20) # 20th of each month
        amount = 1000.00
        
        desc_out = "Payment to Chase Credit Card"
        tx_hash_out = hashlib.sha256(f"{pay_date.date()}|-1000.0|{desc_out}|{checking.id}".encode()).hexdigest()

        t_out = models.Transaction(
            date=pay_date.date(),
            description=desc_out,
            amount=-amount,
            account_id=checking.id,
            to_account_id=credit.id,
            is_transfer=1,
            is_manual=1,
            transaction_hash=tx_hash_out
        )
        
        desc_in = "Payment Thank You - Web"
        tx_hash_in = hashlib.sha256(f"{pay_date.date()}|1000.0|{desc_in}|{credit.id}".encode()).hexdigest()

        t_in = models.Transaction(
            date=pay_date.date(),
            description=desc_in,
            amount=amount,
            account_id=credit.id,
            to_account_id=checking.id, # linking back
            is_transfer=1,
            is_manual=1,
            transaction_hash=tx_hash_in
        )
        transactions.extend([t_out, t_in])

    from sqlalchemy.exc import IntegrityError
    for t in transactions:
        try:
            with db.begin_nested():
                db.add(t)
        except IntegrityError:
            # Transaction (by hash) already exists
            pass
            
    db.commit()
    return len(transactions)
