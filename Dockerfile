# Stage 1: Build the frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend and combine
FROM python:3.13-slim
WORKDIR /app

# Install system dependencies if any (none needed for now but good practice)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast backend dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy backend dependencies
COPY backend/pyproject.toml backend/uv.lock ./backend/
RUN cd backend && uv sync --frozen --no-dev

# Copy backend source
COPY backend/app ./backend/app

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Command to run the application
# We use the virtualenv created by uv
CMD ["backend/.venv/bin/uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
