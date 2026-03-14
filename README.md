# FactGuard

FactGuard is a full-stack media integrity platform for detecting AI-generated text, suspicious images, and plagiarism, with separate user and admin workspaces.

## Stack

- Frontend: React 19, TypeScript, Vite
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL

## Core Features

- User authentication with signup verification, CAPTCHA, password reset, and optional MFA
- Persistent user and admin sessions stored in the database
- AI text analysis, deepfake image analysis, and plagiarism scanning
- User dashboards for analytics, history, reports, and account settings
- Admin dashboards for users, records, activity logs, and report exports

## Repository Layout

- [`src/`](/c:/Users/dever/FactGuard/src) frontend application
- [`backend/app/`](/c:/Users/dever/FactGuard/backend/app) FastAPI application
- [`backend/app/routers/`](/c:/Users/dever/FactGuard/backend/app/routers) API route modules split by domain
- [`backend/app/services/`](/c:/Users/dever/FactGuard/backend/app/services) detection, mail, session, and temporary-secret services

## Local Development

### Docker

```bash
copy .env.example .env
docker compose up --build
```

The frontend runs on `http://127.0.0.1:5173`, the backend on `http://127.0.0.1:8000`, and PostgreSQL on `localhost:5432`.
The copied `.env` already contains safe defaults for local Docker use, including admin credentials. SMTP and `SERPER_API_KEY` are optional; if left blank, the backend falls back to development behavior and logs OTP/reset values instead of emailing them.

### Frontend

```bash
npm install
npm run dev
```

The frontend runs on `http://127.0.0.1:5173` by default.

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs on `http://127.0.0.1:8000` by default.

## Environment

Root `.env` values used by the backend include:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/factguard_db
FRONTEND_URL=http://localhost:5173
SERPER_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=FactGuard
SMTP_USE_TLS=true
SMTP_USE_SSL=false
SESSION_TTL_SECONDS=28800
SIGNUP_OTP_TTL_SECONDS=600
PASSWORD_RESET_TTL_SECONDS=1800
ADMIN_EMAIL=admin@factguard.com
ADMIN_PASSWORD=@Password04
ADMIN_USERNAME=FactGuard Admin
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Notes

- New backend tables for sessions and temporary secrets are created automatically on startup through SQLAlchemy metadata.
- Existing PostgreSQL schemas are also patched on startup for required user and scan columns.
