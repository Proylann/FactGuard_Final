from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .db import engine, Base
from .routers.api import router as api_router
app = FastAPI(title="FactGuard API")

# --- CORS MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
        print("Database connection successful. Tables created.")
    except Exception as e:
        print(f"Error connecting to database: {e}")
