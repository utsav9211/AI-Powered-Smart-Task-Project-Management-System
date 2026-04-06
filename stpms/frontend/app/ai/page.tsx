"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api"
import { Send, Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/ToastProvider"
import type { AxiosError } from "axios"
import { useSession } from "next-auth/react"
import type { Project } from "@/app/page"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type TaskPreview = {
  title: string
  description?: string
  priority: string
  due_date?: string
  project_id?: number
}

type ProjectSummary = {
  project_id: number
  total: number
  todo: number
  in_progress: number
  done: number
  remaining: Array<{
    id: number
    title: string
    status: string
    priority: string
    due_date?: string | null
  }>
}

type AssistantResponse =
  | { type: "task"; message: string; task: TaskPreview; summary: null }
  | { type: "summary"; message: string; task: null; summary: ProjectSummary }
  | { type: "clarify"; message: string; task: null; summary: null }

export default function AIAssistant() {
  const { status } = useSession()

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<TaskPreview | null>(null)
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [assistantMessage, setAssistantMessage] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState("")
  const { toast } = useToast()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get("/projects/")
        setProjects(res.data)
        if (!selectedProjectId && res.data?.length) {
          setSelectedProjectId(String(res.data[0].id))
        }
      } catch {
        // If unauthenticated or API down, we show a message below.
      }
    }

    if (status === "authenticated") {
      fetchProjects()
    }
  }, [status, selectedProjectId])

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userText = input.trim()

    setLoading(true)
    setError("")
    setPreview(null)
    setSummary(null)

    setAssistantMessage("")

    // Append user message to local history and send last N messages.
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userText }]
    setMessages(nextMessages)

    try {
      const response = await api.post<AssistantResponse>("/ai/assistant", {
        text: userText,
        project_id: selectedProjectId ? parseInt(selectedProjectId, 10) : undefined,
        messages: nextMessages.slice(-10),
      })

      const data = response.data
      setAssistantMessage(data.message)
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }].slice(-20))

      if (data.type === "task") {
        setPreview(data.task)
        toast("AI drafted a task.", "success")
      } else if (data.type === "summary") {
        setSummary(data.summary)
        toast("Project summary ready.", "success")
      } else {
        toast("AI needs one clarification.", "success")
      }
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      const errMsg =
        axiosErr.response?.data?.detail ||
        "AI processing failed. Check backend logs and your GOOGLE_API_KEY."
      setError(errMsg)
      toast(errMsg, "error")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return

    const effectiveProjectId = preview.project_id ?? (selectedProjectId ? parseInt(selectedProjectId, 10) : undefined)
    if (!effectiveProjectId) {
      const msg = "Please select a project before saving the task."
      setError(msg)
      toast(msg, "error")
      return
    }

    setLoading(true)
    setError("")

    try {
      await api.post("/tasks/", {
        title: preview.title,
        description: preview.description,
        priority: preview.priority,
        status: "To Do",
        due_date: preview.due_date ? new Date(preview.due_date).toISOString() : null,
        project_id: effectiveProjectId,
      })
      setPreview(null)
      setInput("")
      setMessages([])
      toast("Task created successfully and added to the board!", "success")
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      const errMsg = axiosErr.response?.data?.detail || "Failed to create task."
      setError(errMsg)
      toast(errMsg, "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 mt-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          <Sparkles className="text-blue-600 h-8 w-8" />
          AI Assistant
        </h1>
        <p className="text-gray-600 mt-2">Describe what needs to be done, and I will create the task for you.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleAskAI} className="p-4 border-b border-gray-200 space-y-3">
          {status !== "authenticated" ? (
            <div className="text-sm text-gray-600">
              Please sign in to use the AI Assistant.
            </div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-red-600">
              Create a project first, then come back here to add AI-generated tasks.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <label className="text-sm font-medium text-gray-700 sm:col-span-1">Project</label>
              <select
                className="sm:col-span-2 w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={loading}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Remind me to finish the login page by Friday, high priority..."
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              disabled={loading || status !== "authenticated" || projects.length === 0}
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || status !== "authenticated" || projects.length === 0}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>

        <div className="p-6 bg-gray-50 min-h-[300px]">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
          
          {loading && !preview && (
            <div className="flex items-center justify-center h-full text-gray-500 space-x-3">
              <Sparkles className="animate-spin h-6 w-6" />
              <span>Analyzing your request...</span>
            </div>
          )}

          {assistantMessage && !loading && (
            <div className="p-4 bg-blue-50 text-blue-900 rounded-md text-sm mb-4 border border-blue-100">
              {assistantMessage}
            </div>
          )}

          {summary && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4 slide-in-bottom">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Project Summary</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                  <div className="text-gray-500">Total</div>
                  <div className="text-gray-900 font-semibold text-lg">{summary.total}</div>
                </div>
                <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                  <div className="text-gray-500">To Do</div>
                  <div className="text-gray-900 font-semibold text-lg">{summary.todo}</div>
                </div>
                <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                  <div className="text-gray-500">In Progress</div>
                  <div className="text-gray-900 font-semibold text-lg">{summary.in_progress}</div>
                </div>
                <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                  <div className="text-gray-500">Done</div>
                  <div className="text-gray-900 font-semibold text-lg">{summary.done}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Remaining tasks</div>
                {summary.remaining.length === 0 ? (
                  <div className="text-sm text-gray-500">No remaining tasks.</div>
                ) : (
                  <div className="border border-gray-200 rounded-md divide-y divide-gray-100 overflow-hidden">
                    {summary.remaining.slice(0, 10).map((t) => (
                      <div key={t.id} className="p-3 bg-white flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{t.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{t.status} • {t.priority}</div>
                        </div>
                      </div>
                    ))}
                    {summary.remaining.length > 10 && (
                      <div className="p-3 text-xs text-gray-500 bg-gray-50">
                        Showing first 10. Open the Tasks page to see all.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSummary(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  disabled={loading}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {preview && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4 slide-in-bottom">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Proposed Task</h3>
              
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-4 gap-4">
                  <span className="font-medium text-gray-500">Title</span>
                  <span className="col-span-3 text-gray-900">{preview.title}</span>
                </div>
                {preview.description && (
                  <div className="grid grid-cols-4 gap-4">
                    <span className="font-medium text-gray-500">Description</span>
                    <span className="col-span-3 text-gray-900">{preview.description}</span>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-4">
                  <span className="font-medium text-gray-500">Priority</span>
                  <span className="col-span-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                      ${preview.priority === 'High' ? 'bg-red-100 text-red-700' :
                        preview.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'}`
                    }>
                      {preview.priority}
                    </span>
                  </span>
                </div>
                {preview.due_date && (
                  <div className="grid grid-cols-4 gap-4">
                    <span className="font-medium text-gray-500">Due Date</span>
                    <span className="col-span-3 text-gray-900">{preview.due_date}</span>
                  </div>
                )}
                {preview.project_id && (
                  <div className="grid grid-cols-4 gap-4">
                    <span className="font-medium text-gray-500">Project ID</span>
                    <span className="col-span-3 text-gray-900">{preview.project_id}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  disabled={loading}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Confirm & Save Task'}
                </button>
              </div>
            </div>
          )}
          
          {!loading && !preview && !summary && !error && (
            <div className="flex items-center justify-center h-full text-gray-400">
              Ask about your project, or describe a task to create.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
