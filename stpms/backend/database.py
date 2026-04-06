from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BACKEND_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./stpms.db")

if DATABASE_URL.startswith("sqlite:///./"):
    relative_path = DATABASE_URL.removeprefix("sqlite:///./")
    absolute_path = (BACKEND_DIR / relative_path).resolve()
    DATABASE_URL = "sqlite:///" + str(absolute_path)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
