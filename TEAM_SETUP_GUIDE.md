# FactGuard - Team Setup Guide

Welcome to FactGuard! This guide will help you set up the project on your local machine step by step.

## 📋 Prerequisites

Before you start, make sure you have the following installed:

- **Git** - [Download](https://git-scm.com/download/win)
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 16+** - [Download](https://nodejs.org/)
- **PostgreSQL** - [Download](https://www.postgresql.org/download/) ⚠️ **REQUIRED**

### Why PostgreSQL is Required

✅ All team members connect to the **same database**  
✅ Accounts and data are **shared** across the team  
✅ No duplication of data  
✅ Real-time collaboration  

❌ Without PostgreSQL, each person would have isolated local data (SQLite)

### Verify Installations

```bash
git --version
python --version
node --version
npm --version
```

---

## 🚀 Step 1: Clone the Repository

```bash
git clone https://github.com/Proylann/FactGuard.git
cd FactGuard
```

This creates a `FactGuard` folder with all the project files.

---

## 🔧 Step 2: Backend Setup

### 2.1 Create Virtual Environment

```bash
cd backend

# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### 2.2 Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs all required Python packages (FastAPI, SQLAlchemy, etc.).

### 2.3 Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env
```

**Now edit the `.env` file** with your configuration:

```env
# PostgreSQL database connection
# 🔑 This MUST point to your SHARED team database!
# Ask your team lead for the correct credentials
DATABASE_URL=postgresql://postgres:password@YOUR_DATABASE_SERVER:5432/factguard_db

# Frontend URL (for CORS and email links)
FRONTEND_URL=http://localhost:5173

# Serper API Key (get from https://serper.dev)
SERPER_API_KEY=your_api_key_here

# JWT Secret (use a strong random string)
SECRET_KEY=your-very-secret-key-here-change-in-production
```

⚠️ **Important:** The `DATABASE_URL` must be provided by your team lead. All team members should use the **SAME** database connection string to access the shared database.

### 2.4 Download ML Models

```bash
python ML_models/download_models.py
```

⏱️ **This may take 5-15 minutes** depending on internet speed. The models are ~700MB.

### 2.5 Set Up Database

```bash
python migrate_db.py
```

This creates the database schema and tables.

---

## 🎨 Step 3: Frontend Setup

### 3.1 Open New Terminal (Keep Backend Terminal Open)

```bash
# Navigate to project root
cd ..
```

### 3.2 Install Dependencies

```bash
npm install
```

This downloads and installs all Node.js packages.

### 3.3 Create Frontend Environment File

```bash
# Copy the example file
cp .env.example .env
```

**Edit the `.env` file:**

```env
VITE_API_URL=http://localhost:8000
```

---

## ▶️ Step 4: Run the Application

### Terminal 1: Run Backend

```bash
cd backend

# Make sure you're in the venv
venv\Scripts\activate  # On Windows
source venv/bin/activate  # On macOS/Linux

# Start the backend server
python -m app.main

# Or use uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 2: Run Frontend

```bash
cd FactGuard  # (from project root)

# Start the development server
npm run dev
```

You should see:
```
VITE v... ready in 123 ms

➜  Local:   http://localhost:5173/
```

### 3. Open Browser

Visit: **http://localhost:5173**

You're done! The application is now running. 🎉

---

## 📁 Project Structure

```
FactGuard/
├── backend/              # Python/FastAPI backend
│   ├── app/
│   │   ├── main.py      # FastAPI entry point
│   │   ├── config.py    # Configuration
│   │   ├── models.py    # Database models
│   │   ├── schemas.py   # Data schemas
│   │   ├── routers/     # API endpoints
│   │   ├── services/    # Business logic
│   │   └── utils/       # Helper utilities
│   ├── ML_models/       # AI/ML models (downloaded separately)
│   ├── tests/           # Test suite
│   ├── requirements.txt # Python dependencies
│   └── .env.example     # Environment template
│
├── src/                 # React TypeScript frontend
│   ├── components/      # Reusable components
│   ├── pages/          # Page components
│   ├── App.tsx         # Main app
│   └── main.tsx        # Entry point
│
├── package.json        # Frontend dependencies
├── vite.config.ts      # Vite configuration
├── .env.example        # Frontend env template
├── SETUP_INSTRUCTIONS.md
└── README.md
```

---

## 🗄️ Understanding the Shared Database

### How It Works

```
All Team Members
    ↓
    ├─→ Member 1 ─────┐
    ├─→ Member 2 ─────┼──→ PostgreSQL Server (SHARED)
    ├─→ Member 3 ─────┤     └─ factguard_db
    └─→ Member 4 ─────┘

✅ Everyone sees the SAME data
✅ Accounts created by one person visible to all
✅ Real-time data synchronization
```

### Setting Up Database Access

**Team Lead (You):**
1. Create PostgreSQL database on your server
2. Create database user with credentials
3. Share connection string with team: `postgresql://user:password@SERVER_IP:5432/factguard_db`

**Team Members:**
1. Receive the connection string from you
2. Paste it in their `.env` file under `DATABASE_URL`
3. They automatically connect to YOUR database

### Example Connection Strings

**Local Testing (same machine):**
```
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/factguard_db
```

**Shared Team Database (over network):**
```
DATABASE_URL=postgresql://factguard_user:secure_password@192.168.1.100:5432/factguard_db
```

**Cloud Database (AWS RDS, etc):**
```
DATABASE_URL=postgresql://admin:password@factguard-db.c1234567890.us-east-1.rds.amazonaws.com:5432/factguard_db
```

---

## 📤 Sharing Connection String with Team

**Create a file: `DATABASE_CREDENTIALS.txt` (secure sharing)**

```
TEAM: Here's your database connection info
DATABASE_URL=postgresql://factguard_user:secure_password@YOUR_SERVER_IP:5432/factguard_db

⚠️ IMPORTANT:
- Keep this connection string SECRET
- Don't commit it to GitHub
- Change the password if shared publicly
- Use environment variables in production
```

Share this securely (Slack, Email, etc) - NOT in GitHub!

---

### **Backend won't start**

❌ Error: `ModuleNotFoundError: No module named 'app'`

✅ Solution:
```bash
cd backend
pip install -r requirements.txt
```

---

### **ML Models downloading fails**

❌ Error: `Connection timeout` or `File not found`

✅ Solution:
```bash
cd backend/ML_models
python download_models.py
```

If it still fails, check your internet connection and try again.

---

### **Database connection error**

❌ Error: `could not connect to server`

✅ Solution:
- Make sure PostgreSQL is running
- Check DATABASE_URL in `.env` is correct
- Verify the connection string from your team lead
- Ensure you can ping the database server: `ping YOUR_SERVER_IP`
- If using cloud database, allow your IP in security groups

**Test the connection:**
```bash
# On Windows (requires PostgreSQL client tools)
psql -h YOUR_SERVER -U username -d factguard_db

# Type your password when prompted
```

---

### **Seeing different data than teammates**

❌ Problem: Other team members' accounts don't show up

✅ Solution:
- Check that `DATABASE_URL` is IDENTICAL to all team members
- Confirm you're all connecting to the SAME server
- If using SQLite by mistake, switch to PostgreSQL connection string
- Restart the backend server after changing `.env`

---

### **Frontend shows blank page**

❌ Error: API connection failed (check browser console)

✅ Solution:
- Verify backend is running on `http://localhost:8000`
- Check `VITE_API_URL` in `.env` is correct
- Backend and frontend must be running simultaneously

---

### **Port already in use**

❌ Error: `Address already in use`

✅ Solution:
```bash
# Kill existing process and run on different port
# Backend on port 8001:
uvicorn app.main:app --reload --port 8001

# Frontend on port 5174:
npm run dev -- --port 5174
```

---

## 🔄 Daily Workflow

Once set up, here's how to run everything:

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate  # Activate virtual env
python -m app.main
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

Visit: http://localhost:5173

---

## 📦 Updating Dependencies

If dependencies are updated:

```bash
# Backend
cd backend
pip install -r requirements.txt --upgrade

# Frontend
npm install
```

---

## 🔐 Important Security Notes

⚠️ **NEVER commit `.env` files to Git!**

The `.gitignore` already protects them, but double-check:
- Keep API keys **secret**
- Change `SECRET_KEY` in production
- Use strong database passwords
- Don't share `.env` files via email

---

## 🤝 Contribution Guidelines

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test thoroughly

4. Commit and push:
   ```bash
   git add .
   git commit -m "Add: description of changes"
   git push origin feature/your-feature-name
   ```

5. Create a Pull Request on GitHub

---

## 📞 Need Help?

1. Check the **Troubleshooting** section above
2. Review the [README.md](./README.md)
3. Check existing GitHub issues
4. Ask the team leads

---

## ✅ Checklist

- [ ] Python 3.11+ installed
- [ ] Node.js 16+ installed
- [ ] Repository cloned
- [ ] Backend virtual environment created
- [ ] Backend dependencies installed
- [ ] ML models downloaded
- [ ] Database configured
- [ ] Frontend dependencies installed
- [ ] Environment files created (`.env`)
- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173
- [ ] Can access http://localhost:5173 in browser

---

## 🎉 Success!

If you see the FactGuard application in your browser, you're all set! 

Happy coding! 🚀
