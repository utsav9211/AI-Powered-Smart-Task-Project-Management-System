import axios from "axios"
import { NextResponse } from "next/server"
import { getBackendBaseUrlCandidates } from "@/lib/backend-url"

type RegisterBody = {
  email?: string
  username?: string
  password?: string
}

export async function POST(req: Request) {
  const body = (await req.json()) as RegisterBody

  if (!body?.email || !body?.username || !body?.password) {
    return NextResponse.json({ detail: "Missing email, username, or password" }, { status: 400 })
  }

  const candidates = getBackendBaseUrlCandidates()
  let lastErrorStatus = 502
  let lastErrorMessage = "Backend is not reachable"

  for (const baseUrl of candidates) {
    try {
      const res = await axios.post(`${baseUrl}/auth/register`, {
        email: body.email,
        username: body.username,
        password: body.password,
      })

      return NextResponse.json(res.data, { status: 201 })
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response) {
        lastErrorStatus = e.response.status
        lastErrorMessage =
          (e.response.data as { detail?: string } | undefined)?.detail || "Registration failed"
        break
      }
    }
  }

  return NextResponse.json({ detail: lastErrorMessage }, { status: lastErrorStatus })
}
