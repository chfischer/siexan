import sqlite3
import os

db_path = "/Users/chfischer/github/wimd/backend/expense_app.db"
print(f"Testing access to: {db_path}")

if not os.path.exists(db_path):
    print("Error: DB file does not exist at this path.")
else:
    print("File exists. Attempting connection...")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Success! Tables found: {tables}")
        conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")
