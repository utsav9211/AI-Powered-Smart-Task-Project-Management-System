"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"

export type Project = {
  id: number
  title: string
  description?: string
  owner_id: number
  created_at: string
  owner: { id: number; username: string; email: string }
  members?: { id: number; username: string; email: string }[]
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')

  useEffect(() => {
    if (status === "authenticated") {
      fetchProjects()
    }
  }, [status])

  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true)
      const res = await api.get('/projects/')
      setProjects(res.data)
    } catch (error) {
      console.error("Error fetching projects:", error)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return
    
    try {
      const res = await api.post('/projects/', {
        title: newProjectTitle,
        description: newProjectDesc
      })
      setProjects([...projects, res.data])
      setNewProjectTitle('')
      setNewProjectDesc('')
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error creating project:", error)
    }
  }

  if (status === "loading") return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Welcome back, {session?.user?.name || 'User'}! Here are your projects.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition"
        >
          + New Project
        </button>
      </div>

      {isLoadingProjects ? (
        <div className="py-10 text-center text-gray-500">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="py-20 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">You don&apos;t have any projects yet.</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-blue-600 font-medium hover:underline focus:outline-none"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {projects.map((project) => (
            <div 
              key={project.id} 
              onClick={() => router.push(`/tasks?projectId=${project.id}`)}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col h-full"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="text-xl font-bold text-gray-900 mb-2 truncate">{project.title}</h3>
              <p className="text-gray-600 text-sm flex-grow line-clamp-3">
                {project.description || "No description provided."}
              </p>
              <div className="text-xs text-gray-400 mt-6 font-medium">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl transform transition-all">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Project Title</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" 
                  value={newProjectTitle} 
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="E.g., Website Redesign"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 min-h-[100px]"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="A brief explanation of this project..."
                />
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-900 font-medium text-sm transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateProject}
                  disabled={!newProjectTitle.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
