from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .db import engine, Base
from .routers.api import router as api_router
app = FastAPI(title="FactGuard API")

cors_origins = list(
    {
        settings.FRONTEND_URL.rstrip("/"),
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
)

# --- CORS MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTER REGISTRATION ---
app.include_router(api_router, prefix="/api")

# --- ROOT ENDPOINT ---
@app.get("/")
def read_root():
    return {"message": "FactGuard API is running"}

# --- DATABASE STARTUP ---
@app.on_event('startup')
def startup():
    print("Connecting to database...")
    try:
        # This creates tables if they don't exist
        Base.metadata.create_all(bind=engine)
        # Ensure username is not uniquely constrained; only email should be unique.
        with engine.begin() as conn:
            conn.execute(text('ALTER TABLE users DROP CONSTRAINT IF EXISTS "Unique"'))
            conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ NULL"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"))
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'pending'"))
        print("Database connection successful. Tables created.")
    except Exception as e:
        print(f"Error connecting to database: {e}")
