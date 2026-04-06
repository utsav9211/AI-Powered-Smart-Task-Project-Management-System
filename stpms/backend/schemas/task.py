from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class PriorityEnum(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"

class StatusEnum(str, Enum):
    todo = "To Do"
    in_progress = "In Progress"
    done = "Done"

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: PriorityEnum = PriorityEnum.medium
    status: StatusEnum = StatusEnum.todo
    due_date: Optional[datetime] = None

class TaskCreate(TaskBase):
    project_id: int
    assignee_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[PriorityEnum] = None
    status: Optional[StatusEnum] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None

class TaskResponse(TaskBase):
    id: int
    project_id: int
    assignee_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
