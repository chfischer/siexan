# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**siexan** (Simple Expense Analyser) is a personal finance app for importing bank CSVs, categorizing transactions, and viewing spending analytics. It consists of a FastAPI backend and a React/Vite frontend, deployable as a single Docker container.

## Development Commands

### Backend
```bash
cd backend
uv sync                              # Install dependencies
uv run uvicorn app.main:app --reload # Start dev server (port 8000)
uv run python test_categorizer.py   # Run categorizer tests
```

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server (port 5173, proxied to backend)
npm run build        # Build to frontend/dist/
```

### Docker
```bash
docker compose -f docker-compose.dev.yml up    # Dev with bind mount
docker compose -f docker-compose.prod.yml up   # Production
```

The Docker image builds the frontend and serves everything from the FastAPI backend on port 8000. Data persists in `./data/` volume.

## Architecture

### Backend (`backend/app/`)
- **FastAPI** application in `main.py` with all API routes inline (no separate router files)
- **SQLite** database selected at runtime via `data/config.json` — no database is hardcoded. The `get_db()` dependency detects DB path changes and reinitializes the engine dynamically.
- An HTTP middleware strips the `/api/` prefix so frontend can use `/api/...` while routes are defined without it.
- Schema migrations are done inline via `init_db_schema()` using `ALTER TABLE` with `try/except` to skip already-applied changes.
- `config.py`: reads/writes `data/config.json` for `current_db` setting; also checks `CURRENT_DB` env var as fallback.

### Categorization Engine (`backend/app/services/categorizer.py`)
Three-layer waterfall in `TransactionCategorizer`:
1. **Exact match** (O(1) dict lookup)
2. **Regex patterns** (case-insensitive, ordered by priority)
3. **ML** (TF-IDF + Naive Bayes, only if trained, threshold 0.7)

Rules encode their target using internal prefixes: `__ID_CAT__:<id>`, `__ID_TRANSFER__:<account_id>`, `__ID_LABEL__:<id>`. The singleton categorizer in `categorization.py` is invalidated and rebuilt whenever rules change. Transactions with `is_manual=1` are skipped during recategorization.

### Data Models (key relationships)
- **Transaction** → belongs to Account, optionally has Category, optional transfer to Account, many-to-many Labels
- **Category** is hierarchical (self-referential `parent_id`). Categories with `target_account_id` are auto-transfer categories (created for each Account under the "Transfer" parent).
- **CategorizationRule** → regex pattern with optional target: category, account (transfer), or label
- **CSVProfile** → stores column mapping, date format, delimiter, header row as JSON config for CSV imports

### Frontend (`frontend/src/`)
- React 18 SPA with React Router v7, no state management library
- All API calls use `axios` with `/api/` prefix (proxied in dev via Vite, served by FastAPI in prod)
- Pages in `src/pages/`: Dashboard, Transactions, CategoryManagement, AccountManagement, Rules (CategorizationRules), MapperManagement (CSV profiles), DatabaseSettings
- The `refreshTrigger` integer prop pattern is used to force re-fetches in child pages after imports

### Database selection flow
The app requires selecting a `.db` file before use. `POST /databases/select` writes to `config.json` and touches `main.py` to trigger uvicorn reload. The `get_db()` FastAPI dependency checks if the configured path changed on every request and reinitializes the SQLAlchemy engine if needed.
