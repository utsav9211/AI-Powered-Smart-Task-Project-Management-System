from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.task import Task
from models.project import Project
from schemas.task import TaskCreate, TaskUpdate, TaskResponse
from models.user import User
from auth.utils import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("/", response_model=List[TaskResponse])
def get_tasks(project_id: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if project_id is None:
        raise HTTPException(status_code=400, detail="project_id is required")
    query = db.query(Task).join(Project).filter(
        ((Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))) & (Task.project_id == project_id)
    )
    return query.all()

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(
        Project.id == task.project_id,
        (Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")
        
    new_task = Task(**task.dict())
    if not new_task.assignee_id:
        new_task.assignee_id = current_user.id
        
    db.add(new_task)
    try:
        db.commit()
        db.refresh(new_task)
        return new_task
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database Error: " + str(e))

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).join(Project).filter(
        Task.id == task_id,
        (Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).join(Project).filter(
        Task.id == task_id,
        (Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
        
    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).join(Project).filter(
        Task.id == task_id,
        (Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None
