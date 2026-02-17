import sqlite3
import os

DB_PATH = "expense_app.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Migrating database...")
    
    try:
        # Add columns to transactions
        cursor.execute("ALTER TABLE transactions ADD COLUMN is_transfer INTEGER DEFAULT 0")
        print("Added is_transfer to transactions")
    except sqlite3.OperationalError:
        print("is_transfer already exists in transactions")

    try:
        cursor.execute("ALTER TABLE transactions ADD COLUMN to_account_id INTEGER REFERENCES accounts(id)")
        print("Added to_account_id to transactions")
    except sqlite3.OperationalError:
        print("to_account_id already exists in transactions")

    try:
        # Add columns to categorization_rules
        cursor.execute("ALTER TABLE categorization_rules ADD COLUMN target_account_id INTEGER REFERENCES accounts(id)")
        print("Added target_account_id to categorization_rules")
    except sqlite3.OperationalError:
        print("target_account_id already exists in categorization_rules")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
