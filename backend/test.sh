#!/usr/bin/env bash
set -e

# Change directory to backend to ensure correct paths
cd "$(dirname "$0")"

# Activate the virtual environment if it exists
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
fi

# Make sure the current directory is in PYTHONPATH so app can be imported
export PYTHONPATH=.

echo "Running pytest suite..."
.venv/bin/pytest -v tests/

echo "Done!"
