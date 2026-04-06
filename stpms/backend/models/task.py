from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

class PriorityEnum(str, enum.Enum):
    low = "Low"
    medium = "Medium"
    high = "High"

class StatusEnum(str, enum.Enum):
    todo = "To Do"
    in_progress = "In Progress"
    done = "Done"

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.medium, nullable=False)
    status = Column(Enum(StatusEnum), default=StatusEnum.todo, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project")
    assignee = relationship("User")
