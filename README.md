# Siexan

Siexan is a full-stack personal finance and expense management dashboard. It features a React-based frontend and a Python FastAPI backend, utilizing SQLite for data storage and (soon) scikit-learn for intelligent transaction categorization.

## Features

- **Transaction Management**: View and manage transactions, transfers, and expense records.
- **Intelligent Categorization**: (Soon) Automatic categorization of transactions using a machine learning model (`scikit-learn` & `pandas`).
- **Dashboard & Analytics**: Visual insights into expenses with interactive charts (using `Chart.js`).
- **Rules Engine**: Define custom rules to automate the organization of your finances.
- **Database Management**: Integrated file explorer and database settings straight from the dashboard.

## Tech Stack

### Frontend
- **Framework**: React 18, Vite
- **Routing**: React Router DOM
- **Visualization**: Chart.js, react-chartjs-2
- **Icons**: Lucide React
- **Styling**: Standard CSS / Custom Styles

### Backend
- **Framework**: FastAPI, Uvicorn
- **Data ML & Analysis**: Pandas, Scikit-learn
- **Database**: SQLite, SQLAlchemy
- **Validation**: Pydantic
- **Testing**: Pytest, Pytest-asyncio

### Infrastructure
- **Containerization**: Docker (multi-stage builds for serving frontend & backend from a single container), Docker Compose.

## Getting Started

### Prerequisites

- Node.js & npm (for local frontend development)
- Python 3.13+ & `uv` or `pip` (for local backend development)
- Docker & Docker Compose (for containerized deployment)

### Running Locally with Docker (Source)

You can easily spin up the entire application using Docker Compose to build from your local source code:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Running in Production (Pre-built Image)

If you just want to run the latest version without building from source, you can use the production configuration which pulls the image directly from the GitHub Container Registry:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

The application will be accessible via your browser at `http://localhost:8000`.

### Development Setup

**Backend (Python/FastAPI):**
1. Navigate to `backend/`
2. Create and activate a virtual environment (e.g., using `uv` or `python -m venv .venv`).
3. Install dependencies: `pip install -r requirements.txt` (or via `pyproject.toml`).
4. Run the development server: `fastapi dev main.py` or `uvicorn app.main:app --reload`

**Frontend (React/Vite):**
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

## License

This project is private/unlicensed.
