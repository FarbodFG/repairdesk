type SessionSnapshot = { active: boolean; expired: boolean; generation: number }
const storageKey = 'repairdesk.refresh'
function storedRefresh() {
  try {
    return sessionStorage.getItem(storageKey)
  } catch {
    return null
  }
}
let refreshToken: string | null = storedRefresh()
let accessToken: string | null = null
let snapshot: SessionSnapshot = { active: !!refreshToken, expired: false, generation: 0 }
const listeners = new Set<() => void>()
function persist(value: string | null) {
  try {
    if (value) sessionStorage.setItem(storageKey, value)
    else sessionStorage.removeItem(storageKey)
  } catch {
    /* Memory-only session when browser storage is unavailable. */
  }
}
export const session = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  access: () => accessToken,
  refresh: () => refreshToken,
  set: (tokens: { access: string; refresh: string }) => {
    accessToken = tokens.access
    refreshToken = tokens.refresh
    persist(refreshToken)
    snapshot = { active: true, expired: false, generation: snapshot.generation + 1 }
    listeners.forEach((fn) => fn())
  },
  updateAccess: (token: string, generation: number) => {
    if (generation === snapshot.generation && snapshot.active) accessToken = token
  },
  clear: (expired = false) => {
    accessToken = null
    refreshToken = null
    persist(null)
    snapshot = { active: false, expired, generation: snapshot.generation + 1 }
    listeners.forEach((fn) => fn())
  },
}
