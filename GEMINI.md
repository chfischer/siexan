# Siexan (Simple Expense Analyser)

Siexan is a full-stack personal finance and expense management dashboard. It allows users to import, manage, and analyze transactions across multiple accounts using an intelligent rules-based categorization engine.

## Project Overview

- **Frontend:** React 18 (Vite), Chart.js (visualization), Lucide React (icons), Axios (API client).
- **Backend:** FastAPI (Python 3.13+), SQLAlchemy (SQLite), Pandas (data manipulation), Scikit-learn (ML categorization - in progress).
- **Infrastructure:** Docker and Docker Compose (multi-stage builds).

### Project Structure

- `backend/`: FastAPI application code.
  - `app/`: Main application logic (models, schemas, routes, services).
  - `tests/`: Pytest suite for backend validation.
- `frontend/`: React Vite application.
  - `src/components/`: Reusable UI components.
  - `src/pages/`: Main application views (Dashboard, Transactions, Rules, etc.).
- `data/`: Default storage directory for SQLite databases (`.db`) and `config.json`.
- `logs/`: Application logs.

## Building and Running

### Development (Docker Compose)
The recommended way to run the entire stack for development is via Docker Compose:
```bash
docker-compose -f docker-compose.dev.yml up --build
```
The application will be accessible at `http://localhost:8000`.

### Local Development

#### Backend
1. Navigate to `backend/`.
2. Create and activate a virtual environment (e.g., `uv venv` or `python -m venv .venv`).
3. Install dependencies: `pip install -e .` or `uv sync`.
4. Run the server: `fastapi dev main.py` or `uvicorn app.main:app --reload`.

#### Frontend
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev`.

### Testing
- **Backend:** Run tests using `./backend/test.sh` or `pytest backend/tests/`.
- **Frontend:** No automated frontend tests detected yet. (TODO: Add Vitest or Playwright).

## Development Conventions

### Backend
- **Dependency Management:** Use `uv` for managing Python dependencies (`pyproject.toml`, `uv.lock`).
- **API Routing:** All API endpoints are prefixed with `/api/` in the frontend; the backend middleware (`strip_api_prefix`) handles stripping this prefix before routing.
- **Database:** SQLite is used for storage. The `data/` directory is mapped into containers for persistence.
- **Categorization Rules:** Rules use regex patterns to match transaction descriptions. They are ordered by `priority` (lower value = higher priority).

### Frontend
- **State Management:** Primarily uses React Hooks (`useState`, `useEffect`).
- **Styling:** Standard CSS with custom variables for theme consistency.
- **API Communication:** Centralized via Axios, typically pointing to `/api`.

### Deployment
- **Docker:** Uses multi-stage builds. In production, the backend serves the built frontend's static files from `frontend/dist`.
- **Database Selection:** The application supports multiple SQLite databases. The active database is tracked in `data/config.json`.
