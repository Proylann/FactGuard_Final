# FactGuard Backend (FastAPI + Postgres)

This folder provides a minimal Clean Architecture layout for the Python backend.

Structure:
- app/
  - config.py  (settings)
  - db.py      (SQLAlchemy engine, session, Base)
  - models.py  (SQLAlchemy models)
  - schemas.py (Pydantic request/response schemas)
  - repositories.py (data access layer)
  - services.py (business logic / use-cases)
  - api.py     (FastAPI routers)
  - main.py    (FastAPI app)

Quick start (from `backend` folder):

Windows PowerShell:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
# ensure .env at project root has DATABASE_URL set, or set it manually
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Endpoints:
- POST /api/signup  { "email": "x@x.com", "password": "secret" }
- POST /api/signin  { "email": "x@x.com", "password": "secret" }

Notes:
- This is intentionally minimal to bootstrap development. Use Alembic for migrations in production.
- Password hashing uses `passlib[bcrypt]`.
- `models.Base.metadata.create_all` is used on startup for convenience.
