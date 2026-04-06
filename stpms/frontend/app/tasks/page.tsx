"use client"

import KanbanBoard, { Task } from "@/components/KanbanBoard"
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import api from "@/lib/api"
import { useSession } from "next-auth/react"
import { Project } from "@/app/page"
import type { AxiosError } from "axios"

export default function TasksPage() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('projectId')
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('Medium')
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdParam || '')

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteError, setInviteError] = useState('')

  const currentProject = projectIdParam ? projects.find(p => p.id.toString() === projectIdParam) : null
  const allMembers = currentProject ? [currentProject.owner, ...(currentProject.members || [])] : []

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch projects for the dropdown
      const projectsRes = await api.get('/projects/')
      setProjects(projectsRes.data)
      
      let effectiveProjectId = selectedProjectId
      if (!effectiveProjectId && projectsRes.data.length > 0) {
        effectiveProjectId = projectsRes.data[0].id.toString()
        setSelectedProjectId(effectiveProjectId)
      }

      // Only fetch tasks if we have a project id
      if (effectiveProjectId) {
        const tasksUrl = `/tasks/?project_id=${effectiveProjectId}`
        const tasksRes = await api.get(tasksUrl)
        setTasks(tasksRes.data)
      } else {
        setTasks([])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    if (status === "authenticated" && selectedProjectId) {
      fetchData()
    }
  }, [status, selectedProjectId, fetchData])

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedProjectId) return;
    try {
      const res = await api.post('/tasks/', {
        title: newTaskTitle,
        priority: newTaskPriority,
        status: 'To Do',
        project_id: parseInt(selectedProjectId)
      })
      setTasks([...tasks, res.data])
      setNewTaskTitle('')
      setNewTaskPriority('Medium')
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error creating task:", error)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteUsername.trim() || !currentProject) return;
    setInviteError('')
    
    try {
      await api.post(`/projects/${currentProject.id}/members`, {
        username: inviteUsername
      })
      fetchData() // Refresh members UI
      setInviteUsername('')
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setInviteError(axiosErr.response?.data?.detail || "Failed to invite user")
    }
  }

  if (status === "loading" || isLoading) return <div className="py-10 text-center text-gray-500">Loading...</div>
  if (!selectedProjectId) return <div className="py-10 text-center text-gray-500">Please select a project to view tasks.</div>

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {currentProject ? currentProject.title + ' Tasks' : 'Project Tasks'}
          </h1>
          <p className="text-gray-600 mt-1">Manage your team&apos;s work across projects.</p>
        </div>
        <div className="flex space-x-3">
          {currentProject && (
            <button 
              onClick={() => setIsTeamModalOpen(true)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-300 transition"
            >
              Team Members
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition"
          >
            + New Task
          </button>
        </div>
      </div>

      <KanbanBoard tasks={tasks} setTasks={setTasks} />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Create New Task</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Project</label>
                {projects.length === 0 ? (
                  <div className="text-sm text-red-500">You must create a project first.</div>
                ) : (
                  <select 
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" 
                  value={newTaskTitle} 
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="E.g., Update documentation"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                <select 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-900 font-medium text-sm transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateTask}
                  disabled={!newTaskTitle.trim() || projects.length === 0}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTeamModalOpen && currentProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Team Members for {currentProject.title}</h2>
            
            <div className="mb-6 space-y-2 max-h-48 overflow-y-auto">
              <h3 className="font-semibold text-sm text-gray-700">Team Members ({allMembers.length})</h3>
              {allMembers.length > 0 ? (
                <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
                  {allMembers.map(member => (
                    <li key={member.id} className="py-2 px-3 text-sm text-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50">
                      <div>
                        <span className="font-medium mr-2">
                          {member.username}
                          {member.id === currentProject.owner_id && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">Owner</span>
                          )}
                        </span>
                        <span className="text-gray-500">({member.email})</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic">No team members yet.</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Invite New Member</h3>
              {inviteError && <p className="text-red-500 text-xs mb-2">{inviteError}</p>}
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  className="flex-1 border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm" 
                  value={inviteUsername} 
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="Enter username to invite"
                />
                <button 
                  onClick={handleInviteMember}
                  disabled={!inviteUsername.trim()}
                  className="bg-green-600 text-white px-3 py-2 rounded-md font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Invite User
                </button>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button 
                onClick={() => { setIsTeamModalOpen(false); setInviteError(''); }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-900 font-medium text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}