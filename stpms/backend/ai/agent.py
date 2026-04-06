import os
import json
from functools import lru_cache
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field
from typing import Optional, Literal
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")


@lru_cache
def _get_llm() -> ChatGoogleGenerativeAI:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Gemini API key is not configured. Set GOOGLE_API_KEY (or GEMINI_API_KEY) in backend/.env"
        )
    return ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key,
        temperature=0.2,
    )

class TaskExtraction(BaseModel):
    title: str = Field(description="A concise title for the task.")
    description: Optional[str] = Field(None, description="Detailed instructions or description of the task.")
    priority: str = Field(description="The priority of the task. Must be one of 'Low', 'Medium', or 'High'.")
    due_date: Optional[str] = Field(None, description="The due date of the task in YYYY-MM-DD format if mentioned, otherwise null.")
    project_id: Optional[int] = Field(None, description="The ID of the project if explicitly mentioned, otherwise null.")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


def _clean_llm_json(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


def _fallback_priority(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    if any(k in text for k in ["urgent", "asap", "immediately", "critical", "blocker", "broken", "down", "incident"]):
        return "High"
    if any(k in text for k in ["later", "whenever", "nice to have", "idea", "explore", "maybe"]):
        return "Low"
    return "Medium"


def _fallback_due_date(text: str) -> Optional[str]:
    # Very small heuristic: YYYY-MM-DD anywhere in text.
    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    return m.group(1) if m else None


def _fallback_project_id(text: str) -> Optional[int]:
    # Matches: "project 3", "in project 12"
    m = re.search(r"\bproject\s+(\d+)\b", text, flags=re.IGNORECASE)
    return int(m.group(1)) if m else None


def _fallback_task_extraction(text: str, default_project_id: Optional[int] = None) -> dict:
    cleaned = text.strip()
    title = _fallback_task_title(cleaned)
    description = _fallback_task_description(cleaned, title)

    data = {
        "title": title,
        "description": description,
        "priority": _fallback_priority(title, cleaned),
        "due_date": _fallback_due_date(cleaned),
        "project_id": _fallback_project_id(cleaned),
    }

    if data.get("project_id") is None and default_project_id is not None:
        data["project_id"] = default_project_id
    return data


def _squash_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _derive_intent_text(text: str, messages: Optional[list[ChatMessage]]) -> str:
    """Derive a single text blob representing the user's intent across the conversation.

    We bias toward the user's recent messages so the created task reflects the whole chat.
    """
    current = _squash_whitespace(text)
    if not messages:
        return current

    user_bits: list[str] = []
    for m in messages[-12:]:
        if m.role == "user":
            c = _squash_whitespace(m.content)
            if c:
                user_bits.append(c)

    # Keep only the most recent few user messages to avoid enormous prompts.
    user_bits = user_bits[-5:]

    # Ensure the latest user text is included.
    if current and (not user_bits or user_bits[-1].lower() != current.lower()):
        user_bits.append(current)

    # Deduplicate consecutive repeats.
    deduped: list[str] = []
    for bit in user_bits:
        if not deduped or deduped[-1].lower() != bit.lower():
            deduped.append(bit)

    return _squash_whitespace(" \n".join(deduped))


def _fallback_task_title(text: str, project_title: Optional[str] = None) -> str:
    """Create a short, actionable title without copying the full prompt."""
    t = _squash_whitespace(text)
    t_lower = t.lower()
    project_hint = project_title or "this project"

    # If user asks for suggestions, create a sensible next-step task.
    if any(k in t_lower for k in ["suggest", "what task", "which task", "give me tasks", "help me add"]):
        if "design" in t_lower or "ui" in t_lower or "ux" in t_lower or "wireframe" in t_lower:
            return f"Create UI wireframes for {project_hint}"[:80]
        if "api" in t_lower or "key" in t_lower or "auth" in t_lower:
            return f"Define auth and API integration plan for {project_hint}"[:80]
        return f"Define initial task backlog for {project_hint}"[:80]

    # Otherwise, extract a short phrase from the first sentence.
    first = re.split(r"[\n\.!?]", t, maxsplit=1)[0].strip() or t

    # Remove leading filler phrases.
    first = re.sub(
        r"^(please\s+|can\s+you\s+|could\s+you\s+|i\s+want\s+to\s+|i\s+need\s+to\s+)",
        "",
        first,
        flags=re.IGNORECASE,
    ).strip()

    # Clamp by words to avoid copying full paragraph.
    words = first.split()
    if len(words) > 12:
        first = " ".join(words[:12]).rstrip() + "…"

    # Final clamp.
    if len(first) > 80:
        first = first[:77].rstrip() + "..."
    return first or "Create a new task"


def _fallback_task_description(text: str, title: str) -> Optional[str]:
    """Prefer a short summary over repeating the whole prompt."""
    t = _squash_whitespace(text)
    if not t:
        return None

    # If the title already captures the user message, skip description.
    if t.lower() == _squash_whitespace(title).lower():
        return None

    # If the user is asking for suggestions, provide a concise, actionable description.
    t_lower = t.lower()
    if any(k in t_lower for k in ["suggest", "what task", "which task"]):
        if any(k in t_lower for k in ["design", "ui", "ux", "wireframe"]):
            return "Draft low-fidelity wireframes for the main screens and user flows, then review and iterate based on feedback."
        return "Pick the next highest-value deliverable, define acceptance criteria, and break it into sub-steps if needed."

    # Otherwise keep a short (1-2 sentence) summary, not the whole paragraph.
    parts = re.split(r"(?<=[.!?])\s+", t)
    summary = " ".join(parts[:2]).strip()
    if len(summary) > 240:
        summary = summary[:237].rstrip() + "..."
    return summary or None


def _wants_suggestion(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in [
        "suggest",
        "what task",
        "which task",
        "recommend",
        "help me add",
        "can you tell which task",
    ])


def _has_area_signal(text: str) -> bool:
    t = (text or "").lower()

    # Tokenize to avoid false positives like "ui" in "building".
    tokens = set(re.findall(r"[a-z0-9]+", t))

    token_keywords = {
        "ui",
        "ux",
        "api",
        "ci",
        "qa",
        "llm",
        "db",
    }
    if tokens.intersection(token_keywords):
        return True

    # Longer keywords can be safely matched as substrings.
    substring_keywords = [
        "design",
        "wireframe",
        "figma",
        "backend",
        "database",
        "schema",
        "frontend",
        "next",
        "react",
        "model",
        "gemini",
        "prompt",
        "deploy",
        "docker",
        "server",
        "testing",
        "test",
    ]
    return any(k in t for k in substring_keywords)


def _clarification_question(project_title: Optional[str] = None) -> str:
    proj = project_title or "this project"
    return (
        f"Sure — what kind of task should I suggest for {proj}? "
        "Choose one: UI/UX design, backend/API, AI/LLM, testing, or deployment."
    )

def parse_task_from_text(text: str, default_project_id: Optional[int] = None) -> dict:
    """
    Extracts structured task details from a natural language request.
    """
    prompt = PromptTemplate.from_template(
        "You are an AI assistant helping to create a task in a project management system.\n\n"
        "Important rules:\n"
        "- Do NOT copy the user's full sentence into the title. Rewrite it into a short, actionable task title (max 70 chars).\n"
        "- If the user is asking for suggestions (e.g. 'what task should I add?'), propose ONE best next task for the selected project.\n"
        "- Use imperative verb form in the title (e.g. 'Design...', 'Implement...', 'Create...').\n\n"
        "Extract the following information from the user's sentence:\n"
        "- Title (short, actionable)\n"
        "- Description (any extra context)\n"
        "- Priority (High, Medium, or Low. Default to Medium if not specified)\n"
        "- Due date (YYYY-MM-DD if mentioned, otherwise null)\n"
        "- Project ID (integer, only if explicitly mentioned like 'in project 1')\n\n"
        "User sentence: {text}\n\n"
        "Respond ONLY with a valid JSON object matching this schema:\n"
        "{{ 'title': 'string', 'description': 'string or null', 'priority': 'High|Medium|Low', 'due_date': 'YYYY-MM-DD or null', 'project_id': integer or null }}"
    )
    
    try:
        chain = prompt | _get_llm()
        response = chain.invoke({"text": text})
    except Exception:
        return _fallback_task_extraction(text, default_project_id=default_project_id)
    
    # Clean up markdown JSON formatting if present
    content = _clean_llm_json(response.content)
        
    try:
        data = json.loads(content.strip())
        if data.get("project_id") is None and default_project_id is not None:
            data["project_id"] = default_project_id
        return data
    except json.JSONDecodeError:
        return _fallback_task_extraction(text, default_project_id=default_project_id)


def _fallback_intent(text: str) -> str:
    t = text.lower()
    if any(k in t for k in [
        "task left",
        "tasks left",
        "remaining task",
        "remaining tasks",
        "pending task",
        "pending tasks",
        "what's left",
        "whats left",
        "how many tasks",
        "project status",
        "progress",
    ]):
        return "project_summary"
    return "create_task"


def analyze_user_message(
    text: str,
    default_project_id: Optional[int] = None,
    project_title: Optional[str] = None,
    messages: Optional[list[ChatMessage]] = None,
    existing_open_tasks: Optional[list[str]] = None,
) -> dict:
    """Analyze the user's message and decide what the assistant should do.

    Returns a dict with this shape:
      {"intent": "create_task"|"project_summary"|"clarify", "message": str, "task": dict|None}

    This function uses Gemini when configured; otherwise it falls back to heuristics.
    """

    intent_text = _derive_intent_text(text, messages)

    # If user is asking for suggestions but hasn't provided any area,
    # ask exactly one clarifying question first.
    if _wants_suggestion(intent_text) and not _has_area_signal(intent_text):
        return {
            "intent": "clarify",
            "message": _clarification_question(project_title=project_title),
            "task": None,
        }

    # Fallback path if Gemini isn't configured
    try:
        llm = _get_llm()
    except Exception:
        intent = _fallback_intent(text)
        if intent == "project_summary":
            return {
                "intent": "project_summary",
                "message": "Here is the current status of this project.",
                "task": None,
            }
        return {
            "intent": "create_task",
            "message": "I drafted one concise task based on our conversation. Please confirm before saving.",
            "task": _fallback_task_extraction(intent_text, default_project_id=default_project_id),
        }

    convo = ""
    if messages:
        # Keep last 10 messages max to control prompt length.
        trimmed = messages[-10:]
        convo_lines: list[str] = []
        for m in trimmed:
            role = "User" if m.role == "user" else "Assistant"
            convo_lines.append(f"{role}: {_squash_whitespace(m.content)}")
        convo = "\n".join(convo_lines)

    tasks_context = ""
    if existing_open_tasks:
        items = [t for t in existing_open_tasks if t][:10]
        if items:
            tasks_context = "\n" + "\n".join(f"- {t}" for t in items)

    prompt = PromptTemplate.from_template(
        "You are an AI assistant in a project management app. The user is interacting in a chat.\n"
        "Your job is to understand intent and respond with a JSON object ONLY.\n\n"
        "Context:\n"
        "- Selected project_id (if any): {project_id}\n"
        "- Selected project title (if any): {project_title}\n\n"
        "- Existing open tasks in this project (avoid duplicates if possible):{existing_tasks}\n\n"
        "Conversation so far (most recent last):\n{conversation}\n\n"
        "User message: {text}\n\n"
        "Choose intent:\n"
        "- create_task: user wants to create a new task\n"
        "- project_summary: user is asking about remaining tasks, progress, tasks left, status, etc.\n"
        "- clarify: user request is ambiguous and you need one short clarifying question\n\n"
        "If intent=create_task:\n"
        "- Create EXACTLY ONE task that captures the user's real intent across the conversation.\n"
        "- Use the conversation context as the primary source of intent (not only the latest message).\n"
        "- Do NOT copy/paste the user's paragraph as the title. Rewrite into a short actionable title (max 70 chars).\n"
        "- Use imperative verb form: 'Design...', 'Implement...', 'Create...', 'Fix...', 'Define...'.\n"
        "- Put details in description (1-3 sentences).\n"
        "- If the user is asking for suggestions ('what task should I add'), propose the single best next task for the selected project.\n"
        "- Include a 'task' object with: title, description (or null), priority (High|Medium|Low), due_date (YYYY-MM-DD or null), project_id (integer or null).\n"
        "If intent!=create_task, set task=null.\n\n"
        "Respond ONLY with JSON: { 'intent': 'create_task|project_summary|clarify', 'message': 'string', 'task': object|null }"
    )

    chain = prompt | llm
    try:
        response = chain.invoke(
            {
                "text": text,
                "project_id": default_project_id,
                "project_title": project_title or "",
                "conversation": convo or "(no prior messages)",
                "existing_tasks": tasks_context or "\n- (none provided)",
            }
        )
        content = _clean_llm_json(response.content)
        data = json.loads(content)
    except Exception:
        intent = _fallback_intent(text)
        if intent == "project_summary":
            return {
                "intent": "project_summary",
                "message": "Here is the current status of this project.",
                "task": None,
            }
        return {
            "intent": "create_task",
            "message": "I drafted one concise task based on our conversation. Please confirm before saving.",
            "task": _fallback_task_extraction(intent_text, default_project_id=default_project_id),
        }

    intent = str(data.get("intent") or "clarify").strip()
    message = str(data.get("message") or "").strip() or "Okay."
    task = data.get("task")

    if intent == "create_task":
        if not isinstance(task, dict):
            task = parse_task_from_text(intent_text, default_project_id=default_project_id)

        # Guardrails: ensure we didn't just copy the full user message.
        try:
            raw_title = str(task.get("title") or "").strip()
            raw_text = _squash_whitespace(text)
            raw_intent = _squash_whitespace(intent_text)
            title_l = _squash_whitespace(raw_title).lower()
            text_l = raw_text.lower()
            intent_l = raw_intent.lower()

            looks_copied = False
            if raw_title and raw_text and title_l == text_l:
                looks_copied = True
            if raw_title and raw_intent and title_l == intent_l:
                looks_copied = True

            # If title is a long substring of the user's message, it's usually a copy.
            if raw_title and raw_text and len(raw_title) >= 40 and title_l in text_l:
                looks_copied = True
            if raw_title and raw_intent and len(raw_title) >= 40 and title_l in intent_l:
                looks_copied = True

            # If title is basically the first sentence / first clause of the message.
            first_clause = _squash_whitespace(re.split(r"[\n\.!?]", raw_text, maxsplit=1)[0])
            if first_clause and _squash_whitespace(raw_title).lower() == first_clause.lower() and len(first_clause) >= 30:
                looks_copied = True

            if looks_copied:
                task["title"] = _fallback_task_title(intent_text, project_title=project_title)
                if not task.get("description"):
                    task["description"] = _fallback_task_description(intent_text, task["title"])
        except Exception:
            pass

        # Final clamp
        if isinstance(task.get("title"), str) and len(task["title"]) > 80:
            task["title"] = task["title"][:77].rstrip() + "..."

        # Post-check: if the user asked for a suggestion but result is generic,
        # prefer asking one clarifying question.
        if _wants_suggestion(intent_text) and not _has_area_signal(intent_text):
            generic_titles = {
                "define initial task backlog for this project",
                "define initial task backlog for this project...",
                "define initial task backlog for this project…",
                "define initial task backlog for this project",
                "define initial task backlog for this project"[:80].lower(),
            }
            title_l = _squash_whitespace(str(task.get("title") or "")).lower()
            if title_l in generic_titles or title_l.startswith("define initial task backlog"):
                return {
                    "intent": "clarify",
                    "message": _clarification_question(project_title=project_title),
                    "task": None,
                }

        if task.get("project_id") is None and default_project_id is not None:
            task["project_id"] = default_project_id
        return {"intent": "create_task", "message": message, "task": task}

    if intent == "project_summary":
        return {"intent": "project_summary", "message": message, "task": None}

    # clarify
    return {"intent": "clarify", "message": message, "task": None}

def auto_assign_priority(title: str, description: str = "") -> str:
    """
    Analyzes task title and description to auto-assign a priority (High, Medium, Low).
    """
    prompt = PromptTemplate.from_template(
        "You an AI project manager evaluating the urgency of a task.\n\n"
        "Task Title: {title}\n"
        "Task Description: {description}\n\n"
        "Evaluate the priority based on keywords (e.g., 'urgent', 'ASAP', 'broken', 'bug' usually mean High. 'update', 'fix' mean Medium. 'explore', 'idea' mean Low).\n"
        "Respond ONLY with one word: 'High', 'Medium', or 'Low'."
    )
    
    try:
        chain = prompt | _get_llm()
        response = chain.invoke({"title": title, "description": description})
    except Exception:
        return _fallback_priority(title, description)
    
    priority = response.content.strip().title()
    if priority not in ["High", "Medium", "Low"]:
        return _fallback_priority(title, description)
    return priority
