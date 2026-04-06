from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from ai.agent import parse_task_from_text, auto_assign_priority, analyze_user_message, ChatMessage
from models.user import User
from auth.utils import get_current_user
from sqlalchemy.orm import Session
from database import get_db
from models.project import Project
from models.task import Task, StatusEnum

router = APIRouter(prefix="/ai", tags=["AI"])

class NaturalLanguageTaskRequest(BaseModel):
    text: str
    project_id: int | None = None

class PriorityAnalysisRequest(BaseModel):
    title: str
    description: str = ""


class ProjectSummaryResponse(BaseModel):
    project_id: int
    total: int
    todo: int
    in_progress: int
    done: int
    remaining: list[dict]


class AssistantRequest(BaseModel):
    text: str
    project_id: int | None = None
    messages: list[ChatMessage] | None = None


class AssistantResponse(BaseModel):
    type: str  # task | summary | clarify
    message: str
    task: dict | None = None
    summary: ProjectSummaryResponse | None = None

@router.post("/extract-task")
def extract_task(request: NaturalLanguageTaskRequest, current_user: User = Depends(get_current_user)):
    try:
        result = parse_task_from_text(request.text, default_project_id=request.project_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-priority")
def analyze_priority(request: PriorityAnalysisRequest, current_user: User = Depends(get_current_user)):
    try:
        priority = auto_assign_priority(title=request.title, description=request.description)
        return {"priority": priority}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/project-summary", response_model=ProjectSummaryResponse)
def project_summary(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id,
        ((Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))),
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")

    tasks = db.query(Task).filter(Task.project_id == project_id).all()

    todo = sum(1 for t in tasks if t.status == StatusEnum.todo)
    in_progress = sum(1 for t in tasks if t.status == StatusEnum.in_progress)
    done = sum(1 for t in tasks if t.status == StatusEnum.done)

    remaining = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status.value,
            "priority": t.priority.value,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }
        for t in tasks
        if t.status != StatusEnum.done
    ]

    return {
        "project_id": project_id,
        "total": len(tasks),
        "todo": todo,
        "in_progress": in_progress,
        "done": done,
        "remaining": remaining,
    }


@router.post("/assistant", response_model=AssistantResponse)
def assistant(
    request: AssistantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = None
    existing_open_tasks: list[str] = []
    if request.project_id is not None:
        project = db.query(Project).filter(
            Project.id == request.project_id,
            ((Project.owner_id == current_user.id) | (Project.members.any(id=current_user.id))),
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found or unauthorized")

        # Provide a small list of open tasks to avoid proposing duplicates.
        open_tasks = (
            db.query(Task)
            .filter(Task.project_id == request.project_id, Task.status != StatusEnum.done)
            .order_by(Task.id.desc())
            .limit(10)
            .all()
        )
        existing_open_tasks = [t.title for t in open_tasks if t.title]

    analysis = analyze_user_message(
        request.text,
        default_project_id=request.project_id,
        project_title=project.title if project else None,
        messages=request.messages,
        existing_open_tasks=existing_open_tasks,
    )

    if analysis["intent"] == "clarify":
        return {"type": "clarify", "message": analysis["message"], "task": None, "summary": None}

    if analysis["intent"] == "project_summary":
        if request.project_id is None:
            return {
                "type": "clarify",
                "message": "Which project should I summarize? Please select a project.",
                "task": None,
                "summary": None,
            }
        summary = project_summary(project_id=request.project_id, db=db, current_user=current_user)
        return {"type": "summary", "message": analysis["message"], "task": None, "summary": summary}

    # create_task
    task = analysis.get("task") or parse_task_from_text(request.text, default_project_id=request.project_id)
    return {"type": "task", "message": analysis["message"], "task": task, "summary": None}
