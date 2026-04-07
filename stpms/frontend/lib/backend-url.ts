const DEFAULT_BACKEND_URL = "http://localhost:8000"

const normalizeUrl = (value: string): string => value.replace(/\/+$/, "")

export function getBackendBaseUrl(): string {
  return normalizeUrl(process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND_URL)
}

export function getBackendBaseUrlCandidates(): string[] {
  const raw = [
    process.env.BACKEND_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    DEFAULT_BACKEND_URL,
  ]

  const unique: string[] = []
  for (const value of raw) {
    if (!value) continue
    const normalized = normalizeUrl(value)
    if (!unique.includes(normalized)) unique.push(normalized)
  }

  return unique
}

export { DEFAULT_BACKEND_URL }