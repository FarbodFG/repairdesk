import { session } from '../auth/session'
import { ApiError } from './errors'

export function apiUrl(path: string, base = import.meta.env.VITE_API_BASE_URL || '/api') {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
type Options = Omit<RequestInit, 'body'> & { body?: unknown; public?: boolean }
let refreshFlight: { generation: number; promise: Promise<string> } | null = null

async function read(response: Response) {
  if (response.status === 204) return undefined
  if (!response.headers.get('content-type')?.includes('json')) {
    if (response.ok) throw new ApiError(502)
    return undefined
  }
  try {
    return (await response.json()) as unknown
  } catch {
    throw new ApiError(502)
  }
}
async function send(path: string, options: Options, token: string | null) {
  try {
    return await fetch(apiUrl(path), {
      method: options.method,
      signal: options.signal,
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
      throw error
    throw new ApiError(0)
  }
}
async function refreshAccess() {
  const generation = session.getSnapshot().generation
  if (refreshFlight?.generation === generation) return refreshFlight.promise
  const refresh = session.refresh()
  if (!refresh) throw new ApiError(401)
  const promise = (async () => {
    try {
      const response = await send(
        'token/refresh/',
        { method: 'POST', body: { refresh }, public: true },
        null,
      )
      const data = await read(response)
      if (
        !response.ok ||
        !data ||
        typeof data !== 'object' ||
        !('access' in data) ||
        typeof data.access !== 'string'
      )
        throw new ApiError(401)
      if (session.getSnapshot().generation !== generation) throw new ApiError(401)
      session.updateAccess(data.access, generation)
      return data.access
    } catch (error) {
      if (session.getSnapshot().generation === generation) session.clear(true)
      throw error
    } finally {
      if (refreshFlight?.generation === generation) refreshFlight = null
    }
  })()
  refreshFlight = { generation, promise }
  return promise
}
export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const generation = session.getSnapshot().generation
  let token = options.public ? null : session.access()
  if (!options.public && !token && session.refresh()) token = await refreshAccess()
  if (!options.public && !token) throw new ApiError(401)
  let response = await send(path, options, token)
  if (
    response.status === 401 &&
    !options.public &&
    session.refresh() &&
    generation === session.getSnapshot().generation
  ) {
    const nextToken =
      session.access() !== token && session.access() ? session.access()! : await refreshAccess()
    response = await send(path, options, nextToken)
  }
  const data = await read(response)
  if (!response.ok) {
    if (
      response.status === 401 &&
      !options.public &&
      generation === session.getSnapshot().generation
    )
      session.clear(true)
    throw new ApiError(response.status, data)
  }
  if (!options.public && generation !== session.getSnapshot().generation) throw new ApiError(401)
  return data as T
}
