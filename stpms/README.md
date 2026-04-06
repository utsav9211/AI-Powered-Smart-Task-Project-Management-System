# Smart Task & Project Management System (STPMS)

STPMS is an AI-powered project management tool built with a modern stack: Next.js 15, FastAPI, PostgreSQL, Redis, and LangChain (Google Gemini). It allows users to manage multiple projects, drag-and-drop tasks on a Kanban board, and use an AI Assistant to quickly generate tasks from natural language.

## Architecture
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, @dnd-kit, NextAuth
- **Backend**: Python FastAPI, SQLAlchemy, Alembic, JWT Authentication
- **Database**: PostgreSQL
- **Cache**: Redis
- **AI Brain**: LangChain + Google Gemini Pro

## Prerequisites
- Docker & Docker Compose
- Node.js 18+ (if running frontend locally)
- Python 3.10+ (if running backend locally)
- A Google Gemini API Key

## Environment Variables
Before running the application, ensure the `.env` files are configured properly. They have been pre-filled with `.env.example` equivalents in the respective folders.

**`backend/.env`**
```env
DATABASE_URL=postgresql://postgres:password@db:5432/stpms  # Use @db if in Docker, @localhost if running locally
REDIS_URL=redis://redis:6379/0                             # Use //redis if in Docker, //localhost if running locally
JWT_SECRET_KEY=your-super-secret-key-change-me
JWT_ALGORITHM=HS256
GOOGLE_API_KEY=your-google-gemini-api-key
CORS_ORIGIN=http://localhost:3000
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your-nextauth-secret-change-me
NEXTAUTH_URL=http://localhost:3000
```

## Setup & Running with Docker (Recommended)

1. Ensure Docker is running.
2. Build and start all services via Docker Compose:
   ```bash
   docker compose up -d --build
   ```
3. Run Database Migrations (Backend):
   ```bash
   docker exec -it stpms-backend alembic upgrade head
   ```
4. Access the Application:
   - Frontend: `http://localhost:3000`
   - Backend API Docs: `http://localhost:8000/docs`

## Local Development (Without Docker)

### Backend
1. Start infrastructure (DB & Redis): 
   ```bash
   docker compose up -d db redis
   ```
2. Setup Python environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Run migrations and start server:
   ```bash
   alembic upgrade head
   uvicorn main:app --reload
   ```

### Frontend
1. Install node modules:
   ```bash
   cd frontend
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
