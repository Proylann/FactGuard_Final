# Database Setup Guide

## Quick Start with Docker

If you have Docker installed, run Postgres in a container:

```bash
cd C:\Users\dever\FactGuard
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- User: `postgres`
- Password: `password`
- Database: `factguard_db`

Verify it's running:
```bash
docker ps
```

Stop it:
```bash
docker-compose down
```

## Alternative: Local PostgreSQL Installation

If you prefer to install PostgreSQL locally on Windows:

1. Download PostgreSQL 15+ from https://www.postgresql.org/download/windows/
2. During installation, set password to `password` for the `postgres` user
3. Ensure PostgreSQL is running (check Services)
4. Verify connection:
   ```bash
   psql -U postgres -h localhost -d factguard_db
   ```

## Backend Setup

Once Postgres is running, from the `backend` folder:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`
