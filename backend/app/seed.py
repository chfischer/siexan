from sqlalchemy.orm import Session
from . import models

def seed_db(db: Session):
    # 1. Accounts
    if db.query(models.Account).count() == 0:
        checking = models.Account(name="Main Checking Account", type="Checking")
        credit = models.Account(name="Travel Credit Card", type="Credit Card")
        db.add_all([checking, credit])
        print("Accounts seeded.")

    # 2. Categories
    if db.query(models.Category).count() == 0:
        housing = models.Category(name="Housing")
        food = models.Category(name="Food & Dining")
        transport = models.Category(name="Transport")
        shopping = models.Category(name="Shopping")
        entertainment = models.Category(name="Entertainment")
        utilities = models.Category(name="Utilities")
        db.add_all([housing, food, transport, shopping, entertainment, utilities])
        db.flush()
        
        # Subcategories
        groceries = models.Category(name="Groceries", parent_id=food.id)
        restaurants = models.Category(name="Restaurants", parent_id=food.id)
        fuel = models.Category(name="Fuel", parent_id=transport.id)
        db.add_all([groceries, restaurants, fuel])
        print("Categories seeded.")

    # 3. Categorization Rules
    if db.query(models.CategorizationRule).count() == 0:
        db.flush() # Ensure categories have IDs
        food_cat = db.query(models.Category).filter(models.Category.name == "Food & Dining").first()
        groceries_cat = db.query(models.Category).filter(models.Category.name == "Groceries").first()
        transport_cat = db.query(models.Category).filter(models.Category.name == "Transport").first()
        
        rules = [
            models.CategorizationRule(pattern="WHOLEFOODS", target_category_id=groceries_cat.id),
            models.CategorizationRule(pattern="SAFEWAY", target_category_id=groceries_cat.id),
            models.CategorizationRule(pattern="STARBUCKS", target_category_id=food_cat.id),
            models.CategorizationRule(pattern="SHELL", target_category_id=transport_cat.id),
            models.CategorizationRule(pattern="UBER", target_category_id=transport_cat.id),
            models.CategorizationRule(pattern="AMAZON", target_category_id=shopping.id if 'shopping' in locals() else None),
        ]
        # Fix shopping ref if it failed identification in the scope
        shopping_cat = db.query(models.Category).filter(models.Category.name == "Shopping").first()
        for rule in rules:
            if rule.pattern == "AMAZON":
                rule.target_category_id = shopping_cat.id
        
        db.add_all(rules)
        print("Rules seeded.")

    db.commit()
