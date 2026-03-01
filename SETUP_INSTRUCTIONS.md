# Setup Instructions for FactGuard

## Prerequisites
- Python 3.11+
- Node.js 16+
- Git

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Proylann/FactGuard.git
cd FactGuard
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download ML Models
python ML_models/download_models.py

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
# - DATABASE_URL: PostgreSQL connection string
# - SERPER_API_KEY: API key for Serper search
# - SECRET_KEY: JWT secret for authentication
```

### 3. Database Setup
```bash
# Run migrations
python migrate_db.py
```

### 4. Frontend Setup
```bash
# Go back to project root
cd ..

# Install dependencies
npm install

# Configure API URL
# Create/edit .env with:
VITE_API_URL=http://localhost:8000

# Start development server
npm run dev
```

### 5. Run the Backend
```bash
cd backend
python -m app.main
# Or with uvicorn:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## File Size Note

The ML models (`backend/ML_models/`) are excluded from version control due to their large size (>700MB). They need to be downloaded during setup using:

```bash
cd backend
python ML_models/download_models.py
```

## Environment Variables

### Root Level (.env)
```
VITE_API_URL=http://localhost:8000
```

### Backend Level (backend/.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/factguard_db
FRONTEND_URL=http://localhost:5173
SERPER_API_KEY=your_serper_api_key_here
SECRET_KEY=your_secret_key_for_jwt
```

## Docker Setup (Optional)

```bash
docker-compose up -d
```

## Troubleshooting

### ML Models Not Found
Run: `python backend/ML_models/download_models.py`

### Database Connection Failed
- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Run migrations: `python backend/migrate_db.py`

### API Connection Failed
- Check VITE_API_URL matches backend address
- Ensure backend server is running on port 8000

## Project Structure

- `/src` - Frontend (React + TypeScript + Vite)
- `/backend` - Backend API (Python + FastAPI)
  - `/app` - Main application code
  - `/ML_models` - ML model files (downloaded separately)
  - `/tests` - Test suite

## Contributing

1. Create a new feature branch
2. Make your changes
3. Update .gitignore for any new large files
4. Push to GitHub
5. Create a Pull Request

## License

See LICENSE file for details
