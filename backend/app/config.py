import json
import os

# Determine the project root and the data directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
CONFIG_PATH = os.path.join(DATA_DIR, "config.json")

# Ensure DATA_DIR exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR, exist_ok=True)

def get_config():
    if not os.path.exists(CONFIG_PATH):
        # Check environment variable as fallback for first-run
        env_db = os.environ.get("CURRENT_DB")
        if env_db:
            return {"current_db": env_db}
        return {}
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=4)

def get_db_path():
    config = get_config()
    db_name = config.get("current_db")
    if not db_name:
        return None
        
    # If it's an absolute path, use it as is
    if os.path.isabs(db_name):
        return db_name
        
    # Otherwise, assume it's in DATA_DIR
    return os.path.join(DATA_DIR, os.path.basename(db_name))
