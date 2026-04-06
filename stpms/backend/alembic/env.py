import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from dotenv import load_dotenv
from pathlib import Path

import sys
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

# Import your models here to ensure Alembic knows about them
from database import Base
from models.user import User
from models.project import Project
from models.task import Task

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _normalized_database_url(url: str) -> str:
    if url.startswith("sqlite:///./"):
        relative_path = url.removeprefix("sqlite:///./")
        backend_dir = Path(__file__).resolve().parents[1]
        absolute_path = (backend_dir / relative_path).resolve()
        return "sqlite:///" + str(absolute_path)
    return url

def run_migrations_offline() -> None:
    url = _normalized_database_url(os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url")))
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = _normalized_database_url(
        os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
    )
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
