from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from schemas.user import UserResponse

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    owner: UserResponse
    members: List[UserResponse] = []

    class Config:
        from_attributes = True
