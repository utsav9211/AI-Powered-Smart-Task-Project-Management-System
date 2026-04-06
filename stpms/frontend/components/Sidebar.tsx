"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, CheckSquare, Sparkles, LogOut, LogIn } from "lucide-react"
import { useSession, signOut } from "next-auth/react"

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const links = [
    { name: "Projects", href: "/", icon: LayoutDashboard },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "AI Assistant", href: "/ai", icon: Sparkles },
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          STPMS AI
        </h1>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className={`mr-3 h-5 w-5 ${isActive ? "text-blue-700" : "text-gray-400"}`} />
              {link.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        {session ? (
          <div className="flex flex-col space-y-3">
            <div className="text-sm font-medium text-gray-900 px-3">{session.user?.name}</div>
            <button
              onClick={() => signOut()}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
          >
            <LogIn className="mr-3 h-5 w-5 text-gray-400" />
            Sign in
          </Link>
        )}
      </div>
    </div>
  )
}
