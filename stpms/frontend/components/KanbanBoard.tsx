"use client"

import React from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '@/lib/api'

export type Task = { id: number; title: string; status: string; priority: string; due_date?: string }

function SortableItem({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 mb-2 bg-white rounded-md shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative z-10"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
      </div>
      <div className="flex items-center space-x-2">
        <span
          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
            task.priority === 'High' ? 'bg-red-100 text-red-700' :
            task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}
        >
          {task.priority}
        </span>
      </div>
    </div>
  )
}

function KanbanColumn({ column, tasks }: { column: string, tasks: Task[] }) {
  const { setNodeRef } = useDroppable({ id: column })

  return (
    <div className="flex-1 flex flex-col bg-gray-100 p-4 rounded-lg">
      <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">
        {column} <span className="ml-2 text-gray-400 font-normal">({tasks.length})</span>
      </h3>
      <div
        ref={setNodeRef}
        className="flex-1 flex flex-col min-h-[150px]"
      >
        <SortableContext
          id={column}
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <SortableItem key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

export default function KanbanBoard({ tasks, setTasks }: { tasks: Task[], setTasks: React.Dispatch<React.SetStateAction<Task[]>> }) {
  const columns = ['To Do', 'In Progress', 'Done']

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = Number(active.id)
    const overId = over.id

    const activeTask = tasks.find(t => t.id === activeId)
    const overTask = tasks.find(t => t.id === Number(overId))

    if (!activeTask) return

    // If dropping over an empty column area directly
    if (columns.includes(overId as string)) {
      if (activeTask.status === overId) return; // Didn't change
      setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overId as string } : t))
      try {
        await api.put(`/tasks/${activeId}`, { status: overId as string })
      } catch(e) { console.error('Error updating task status', e) }
      return
    }

    // If dropping over another task in a different column
    if (activeTask && overTask && activeTask.status !== overTask.status) {
      setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overTask.status } : t))
      try {
        await api.put(`/tasks/${activeId}`, { status: overTask.status })
      } catch(e) { console.error('Error updating task status', e) }
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 h-full min-h-[500px] mt-6">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column)
          return <KanbanColumn key={column} column={column} tasks={columnTasks} />
        })}
      </div>
    </DndContext>
  )
}
