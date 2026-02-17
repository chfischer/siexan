import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")
DEFAULT_DB = "expense_app.db"

def get_config():
    if not os.path.exists(CONFIG_PATH):
        return {"current_db": DEFAULT_DB}
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=4)

def get_db_path():
    config = get_config()
    db_name = config.get("current_db", DEFAULT_DB)
    # Ensure it's just a filename
    db_name = os.path.basename(db_name)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, db_name)
