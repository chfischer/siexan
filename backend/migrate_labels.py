import sqlite3
import os

DB_PATH = "expense_app.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Create labels table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#6366f1'
            )
        """)
        print("Table 'labels' created or already exists.")

        # 2. Create transaction_labels association table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transaction_labels (
                transaction_id INTEGER,
                label_id INTEGER,
                PRIMARY KEY (transaction_id, label_id),
                FOREIGN KEY (transaction_id) REFERENCES transactions (id),
                FOREIGN KEY (label_id) REFERENCES labels (id)
            )
        """)
        print("Table 'transaction_labels' created or already exists.")

        # 3. Add target_label_id to categorization_rules
        try:
            cursor.execute("ALTER TABLE categorization_rules ADD COLUMN target_label_id INTEGER REFERENCES labels(id)")
            print("Column 'target_label_id' added to 'categorization_rules'.")
        except sqlite3.OperationalError:
            print("Column 'target_label_id' already exists in 'categorization_rules'.")

        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
