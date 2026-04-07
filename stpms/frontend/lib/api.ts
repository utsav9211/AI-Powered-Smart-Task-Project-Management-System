import axios from "axios"
import { getSession } from "next-auth/react"
import { DEFAULT_BACKEND_URL, getBackendBaseUrl } from "@/lib/backend-url"

const api = axios.create({
  baseURL: getBackendBaseUrl(),
})

type RetryableConfig = {
  _retryWithDefaultBackend?: boolean
  baseURL?: string
}

api.interceptors.request.use(
  async (config) => {
    const session = await getSession()
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = (error?.config || {}) as RetryableConfig
    const hasNoResponse = !error?.response

    if (
      hasNoResponse &&
      config &&
      !config._retryWithDefaultBackend &&
      config.baseURL !== DEFAULT_BACKEND_URL
    ) {
      config._retryWithDefaultBackend = true
      config.baseURL = DEFAULT_BACKEND_URL
      return api.request(config)
    }

    return Promise.reject(error)
  }
)

export default api
