# FactGuard - Complete Installation & Setup Guide

> A comprehensive guide for setting up FactGuard on your machine. Follow these steps carefully to get the full system running.

**Last Updated:** March 1, 2026  
**Version:** 1.0  
**GitHub:** https://github.com/Proylann/FactGuard_Final.git

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone the Repository](#clone-the-repository)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [ML Models Setup](#ml-models-setup)
6. [Environment Configuration](#environment-configuration)
7. [Database Setup](#database-setup)
8. [Running the Application](#running-the-application)
9. [Verification & Testing](#verification--testing)
10. [Troubleshooting](#troubleshooting)
11. [Project Structure](#project-structure)

---

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

- **Python 3.11+** - Download from https://www.python.org/
  - ✓ Add Python to PATH during installation
  - ✓ Install pip (included with Python)

- **Node.js v18+** - Download from https://nodejs.org/
  - ✓ Includes npm package manager

- **Git** - Download from https://git-scm.com/
  - ✓ Required for cloning the repository

### Verify Installation

Open a terminal/command prompt and run:

```bash
python --version        # Should show Python 3.11+
pip --version          # Should show pip version
node --version         # Should show Node v18+
npm --version          # Should show npm version
git --version          # Should show git version
```

### System Requirements

- **RAM:** Minimum 8GB (16GB recommended for ML models)
- **Disk Space:** 3GB free (for dependencies and models)
- **Internet:** Required for downloading dependencies and models

---

## Clone the Repository

### Step 1: Choose a Location

Navigate to where you want to store the project:

```bash
# Windows
cd C:\Users\YourUsername\Projects

# macOS/Linux
cd ~/projects
```

### Step 2: Clone the Repository

```bash
git clone https://github.com/Proylann/FactGuard_Final.git
cd FactGuard
```

### Step 3: Verify Repository Structure

```bash
# You should see these main folders:
# - backend/
# - src/
# - public/
# - node_modules/ (will be created during setup)
# And these files:
# - package.json
# - README.md
# - INSTALLATION_GUIDE.md
```

---

## Backend Setup

### Step 1: Navigate to Backend Directory

```bash
cd backend
```

### Step 2: Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` at the start of your terminal prompt after activation.

### Step 3: Upgrade pip

```bash
python -m pip install --upgrade pip
```

### Step 4: Install Python Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- FastAPI - Web framework
- SQLAlchemy - Database ORM
- PyTorch - ML framework
- Transformers - Hugging Face models
- And other dependencies

**Expected output:** Should complete without errors. May take 5-10 minutes.

### Step 5: Verify Backend Installation

```bash
python -c "import fastapi; import torch; import transformers; print('All imports successful!')"
```

**Expected output:** `All imports successful!`

---

## Frontend Setup

### Step 1: Return to Root Directory

```bash
# From backend directory, go back
cd ..
```

### Step 2: Install Node Dependencies

```bash
npm install
```

This will install:
- React
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Lucide icons
- Framer Motion (animations)
- And other dependencies

**Expected output:** `added X packages in Y seconds`

### Step 3: Verify Frontend Installation

```bash
npm list react react-dom typescript
```

**Expected output:** Should show version numbers without errors.

---

## ML Models Setup

The ML models are required for deepfake detection and AI text analysis.

### Step 1: Navigate to ML Models Directory

```bash
cd backend/ML_models
```

### Step 2: Download Models Automatically (Recommended)

```bash
python download_models.py
```

This script will:
- Download Vision Transformer for deepfake detection (~475 MB)
- Download RoBERTa for AI text detection (~350 MB)
- Configure model paths automatically

**Expected output:**
```
Downloading image detector model...
✓ Image detector model ready
Downloading text detector model...
✓ Text detector model ready
All models setup complete!
```

### Step 3: Verify Models Are Downloaded

```bash
# Windows
dir image_detector
dir text_detector

# macOS/Linux
ls -la image_detector/
ls -la text_detector/
```

**Expected files in each directory:**
- `model.safetensors` (the actual model file)
- `config.json` (model configuration)
- `preprocessor_config.json` or `tokenizer.json` (tokenizer config)

### If Automatic Download Fails

**Manual Download from Hugging Face:**

1. Visit https://huggingface.co/
2. Search for "ViT-Deepfake-Detector"
3. Download the model files
4. Place in `backend/ML_models/image_detector/`
5. Repeat for "RoBERTa-AI-Text-Detector"
6. Place in `backend/ML_models/text_detector/`

**Important:** Models are large (~850 MB total), so download may take 10-20 minutes.

### Step 4: Return to Root Directory

```bash
cd ../..
```

---

## Environment Configuration

### Step 1: Copy Environment Template

**Windows:**
```bash
copy backend\.env.example backend\.env
```

**macOS/Linux:**
```bash
cp backend/.env.example backend/.env
```

### Step 2: Edit Backend Environment Variables

Open `backend/.env` in your text editor and configure:

```env
# Database Configuration
DATABASE_URL=sqlite:///./factguard.db
# Or for PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost:5432/factguard

# JWT & Security
SECRET_KEY=your-secret-key-change-this-in-production
JWT_SECRET=your-jwt-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@factguard.app
SMTP_USE_TLS=true

# API Keys
SERPER_API_KEY=your-serper-api-key-here
# Get free key from: https://serper.dev/

# ML Models Paths
DEEPFAKE_MODEL_PATH=backend/ML_models/image_detector
TEXT_MODEL_PATH=backend/ML_models/text_detector

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
```

### Step 3: Get Required API Keys

#### Serper API Key (For Plagiarism Detection)

1. Go to https://serper.dev/
2. Sign up for free account
3. Copy your API key
4. Paste into `SERPER_API_KEY` in `.env`

#### Gmail App Password (For Email Notifications - Optional)

1. Enable 2FA on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate app password for "Mail"
4. Paste into `SMTP_PASSWORD` in `.env`

### Step 4: Copy Frontend Environment (Optional)

```bash
copy .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:8000
```

---

## Database Setup

### Step 1: Initialize Database

The database will auto-initialize on first run, but you can manually create it:

```bash
cd backend

# Activate virtual environment if not already active
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Initialize database (if you have a setup script)
python app/db.py
```

### Step 2: Verify Database

After running the backend for the first time, check for:
- `backend/factguard.db` (SQLite file, about 50 KB)
- Or check your PostgreSQL connection if using Postgres

---

## Running the Application

### Terminal 1: Start Backend Server

```bash
# From root directory, navigate to backend
cd backend

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

The server is now running. Keep this terminal open.

### Terminal 2: Start Frontend Development Server

Open a **new terminal** window/tab:

```bash
# From root directory
npm run dev
```

**Expected output:**
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### Step 3: Access the Application

Open your web browser and navigate to:

**Frontend:** http://localhost:5173  
**Backend API Docs:** http://localhost:8000/docs  
**Backend Redoc:** http://localhost:8000/redoc

---

## Verification & Testing

### Test 1: Frontend is Loading

1. Go to http://localhost:5173
2. You should see the FactGuard landing page
3. Check the browser console (F12) for any errors

**Expected:** Landing page with navigation and feature cards visible.

### Test 2: Backend API is Working

Open another terminal and run:

```bash
# Test API health
curl http://localhost:8000/api/health

# Should return:
# {"status":"healthy"}
```

Or visit: http://localhost:8000/docs to see interactive API documentation.

### Test 3: User Authentication

1. On frontend, click "Sign Up" or "Login"
2. Create a test account
3. You should be redirected to the dashboard

**Expected:** Dashboard loads with analytics widgets.

### Test 4: Deepfake Detection

1. Click on "A.I Tools" → "Deepfake Analyzer"
2. Upload or paste content
3. Click "Run Analysis"

**Expected:** Results show within 10-30 seconds depending on file size.

### Test 5: AI Text Detection

1. Click on "A.I Tools" → "A.I Text Analyzer"
2. Paste sample text
3. Click "Run Analysis"

**Expected:** Results show with confidence score and indicators.

### Test 6: Plagiarism Detection

1. Click on "A.I Tools" → "Plagiarism Checker"
2. Paste text to check
3. Click "Run Plagiarism Scan"

**Expected:** Results show similarity percentage and matching sources.

### Test 7: Database Operations

1. Run an analysis (any of the above tests)
2. Go to "History" tab
3. You should see your recent scan

**Expected:** Scan appears in history with timestamp and result.

---

## Troubleshooting

### Backend Issues

#### Error: "ModuleNotFoundError: No module named 'fastapi'"

**Solution:**
```bash
# Make sure virtual environment is activated
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Reinstall requirements
pip install -r requirements.txt
```

#### Error: "Port 8000 already in use"

**Solution 1:** Kill the process using port 8000
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :8000
kill -9 <PID>
```

**Solution 2:** Use a different port
```bash
uvicorn app.main:app --reload --port 8001
```

Then update frontend `.env`:
```env
VITE_API_URL=http://localhost:8001
```

#### Error: "SERPER_API_KEY not found"

**Solution:** Ensure your `.env` file has:
```env
SERPER_API_KEY=your-actual-api-key-here
```

And restart the backend server.

#### Error: "Model file not found"

**Solution:**
```bash
cd backend/ML_models
python download_models.py
```

Then restart the backend.

#### Slow startup / "Loading models..."

**This is normal!** First startup loads ML models (~1 min). Subsequent starts are faster.

---

### Frontend Issues

#### Error: "npm: command not found"

**Solution:** Node.js not installed or PATH not updated
- Download from https://nodejs.org/
- Restart your terminal after installation
- Verify: `node --version`

#### Error: "ENOENT: no such file or directory"

**Solution:** Dependencies not installed
```bash
npm install
npm run dev
```

#### Port 5173 already in use

**Solution 1:** Kill the process
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5173
kill -9 <PID>
```

**Solution 2:** Use different port
```bash
npm run dev -- --port 3000
```

#### Blank page or errors in browser console

**Solution:** Clear cache and rebuild
```bash
# Delete dependencies
rm -rf node_modules package-lock.json  # macOS/Linux
# or in Windows: rmdir /s node_modules && del package-lock.json

# Reinstall
npm install
npm run dev
```

---

### Database Issues

#### Error: "Database is locked"

**Solution:** Ensure only one instance of the app is running
```bash
# Check for running processes
processes  # See all running apps
# Stop the backend and restart
```

#### SQLAlchemy connection error

**Solution:** Wrong DATABASE_URL
```env
# For SQLite (default):
DATABASE_URL=sqlite:///./factguard.db

# For PostgreSQL:
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
```

---

### Model Issues

#### Error: "OutOfMemoryError"

**Reason:** ML models require ~4GB RAM  
**Solution 1:** Close other applications
**Solution 2:** Increase virtual memory / swap space
**Solution 3:** Use a machine with more RAM

#### Models slow to load

**This is normal:** First load takes 30-60 seconds. Cache makes subsequent loads instant.

#### CUDA/GPU Support (Optional)

If you have NVIDIA GPU:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

---

### Performance Issues

#### Slow Analysis

**Check:**
1. Backend is running (check terminal)
2. Models are fully loaded (first run takes time)
3. System has enough RAM
4. No other heavy processes running

#### Slow Frontend

**Solutions:**
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Check network tab in DevTools (F12)
3. Rebuild frontend: `npm run build && npm run preview`

---

## Project Structure

```
FactGuard/
│
├── backend/                          # FastAPI backend
│   ├── app/
│   │   ├── main.py                  # Main application entry
│   │   ├── config.py                # Configuration
│   │   ├── models.py                # Database models
│   │   ├── schemas.py               # API schemas
│   │   ├── db.py                    # Database setup
│   │   ├── routers/
│   │   │   ├── api.py              # Main API routes
│   │   │   └── routers.py          # Additional routes
│   │   ├── services/
│   │   │   ├── deepfake_detector.py    # Deepfake detection
│   │   │   ├── ai_text_engine.py       # AI text detection
│   │   │   ├── plagiarism_scanner.py   # Plagiarism check
│   │   │   ├── email_service.py        # Email notifications
│   │   │   └── session_service.py      # Session management
│   │   └── utils/
│   │       └── rate_limiter.py     # Rate limiting
│   │
│   ├── ML_models/                   # Machine learning models
│   │   ├── image_detector/          # Deepfake detection model
│   │   └── text_detector/           # AI text detection model
│   │
│   ├── tests/                       # Test files
│   ├── venv/                        # Python virtual environment
│   ├── .env                         # Environment variables
│   ├── .env.example                 # Environment template
│   ├── requirements.txt             # Python dependencies
│   └── README.md                    # Backend documentation
│
├── src/                             # React frontend
│   ├── components/
│   │   └── main/                   # Main view components
│   │       ├── views.tsx           # Dashboard, Analysis, History views
│   │       ├── cards.tsx           # Reusable card components
│   │       ├── SettingsView.tsx    # User settings
│   │       ├── helpers.ts          # Utility functions
│   │       ├── types.ts            # TypeScript types
│   │       └── animations.ts       # Animation definitions
│   │
│   ├── frontend/
│   │   ├── LandingPage.tsx        # Landing page
│   │   ├── Auth.tsx               # Login/Register
│   │   └── Main.tsx               # Main dashboard
│   │
│   ├── assets/                    # Images and static assets
│   ├── App.tsx                    # Root component
│   ├── App.css                    # Global styles
│   ├── index.css                  # Base styles
│   └── main.tsx                   # Entry point
│
├── public/                        # Static files
├── node_modules/                 # NPM dependencies
├── package.json                  # NPM configuration
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite configuration
├── .env                          # Frontend environment
├── .env.example                  # Frontend env template
├── .gitignore                    # Git ignore rules
├── INSTALLATION_GUIDE.md         # This file
├── README.md                     # Project overview
└── SETUP_INSTRUCTIONS.md         # Quick setup
```

---

## Quick Reference Commands

### Start Everything (New Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
venv\Scripts\activate          # Windows; or source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Stop All Services

Press `Ctrl+C` in each terminal

### Useful Commands

```bash
# Build frontend for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Format code
npm run format

# Test backend
cd backend && pytest

# Database migrations (if applicable)
alembic upgrade head
```

---

## Getting Help

### Check Logs

**Backend logs:** Terminal running uvicorn  
**Frontend logs:** Browser Console (F12)  
**Database logs:** `.env` configured database

### Common Issues Checklist

- [ ] All prerequisites installed (`python --version`, `node --version`)
- [ ] Repository cloned correctly
- [ ] Virtual environment activated (see `(venv)` in prompt)
- [ ] All dependencies installed (`pip install -r requirements.txt`, `npm install`)
- [ ] `.env` files configured with required keys
- [ ] ML models downloaded (`backend/ML_models/` has files)
- [ ] Both backend and frontend servers running
- [ ] Correct ports (backend 8000, frontend 5173)
- [ ] No firewall blocking localhost connections

### Support Resources

- **GitHub Issues:** https://github.com/Proylann/FactGuard_Final/issues
- **API Documentation:** http://localhost:8000/docs
- **React Docs:** https://react.dev
- **FastAPI Docs:** https://fastapi.tiangolo.com/

---

## Next Steps

After successful installation:

1. **Explore the Dashboard** - Familiarize with the UI
2. **Test All Features** - Try deepfake, AI text, and plagiarism detection
3. **Read the Code** - Understand the architecture
4. **Join Development** - Contribute to the project
5. **Deploy** - When ready, deploy to production using Docker or cloud platform

---

## Security Notes

⚠️ **Important for Production:**

1. Change `SECRET_KEY` and `JWT_SECRET` to strong random values
2. Use environment variables for sensitive data
3. Enable HTTPS/SSL
4. Use PostgreSQL instead of SQLite
5. Configure CORS properly
6. Implement rate limiting
7. Use secure password hashing
8. Enable HTTPS for API communication
9. Regularly update dependencies: `pip install --upgrade -r requirements.txt`
10. Use `.env` files, never commit secrets

---

**Installation completed!** 🎉

Your FactGuard instance is now ready for development and testing. Happy coding!
