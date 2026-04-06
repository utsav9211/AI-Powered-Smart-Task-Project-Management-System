from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.project import Project
from schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from models.user import User
from auth.utils import get_current_user
from pydantic import BaseModel

class MemberAdd(BaseModel):
    username: str

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("/", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    projects = db.query(Project).filter(
        (Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))
    ).all()
    return projects

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_project = Project(**project.dict(), owner_id=current_user.id)
    db.add(new_project)
    try:
        db.commit()
        db.refresh(new_project)
        return new_project
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database Error: " + str(e))

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(
        Project.id == project_id,
        ((Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id)))
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project_update: ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
        
    db.commit()
    db.refresh(project)
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None

@router.post("/{project_id}/members", response_model=ProjectResponse)
def add_member(project_id: int, member_data: MemberAdd, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")
    
    new_member = db.query(User).filter(User.username == member_data.username).first()
    if not new_member:
        raise HTTPException(status_code=404, detail="User not found")
    
    if new_member in project.members or new_member.id == project.owner_id:
        raise HTTPException(status_code=400, detail="User already in project")
    
    project.members.append(new_member)
    db.commit()
    db.refresh(project)
    return project
