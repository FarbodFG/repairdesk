import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { request } from '../../lib/api/client'
import { keys, queryClient } from '../../lib/api/queries'
import { session } from '../../lib/auth/session'
import type { Me } from '../../types/api'
const AuthContext = createContext<{
  user?: Me
  loading: boolean
  active: boolean
  expired: boolean
  error: unknown
  retry: () => void
  login: (username: string, password: string) => Promise<void>
  logout: () => void
} | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const me = useQuery({
    queryKey: keys.me(state.generation),
    queryFn: ({ signal }) => request<Me>('accounts/me/', { signal }),
    enabled: state.active,
    retry: false,
    staleTime: 60_000,
  })
  useEffect(() => {
    if (!state.active) queryClient.clear()
  }, [state.active])
  async function login(username: string, password: string) {
    const tokens = await request<{ access: string; refresh: string }>('token/', {
      public: true,
      method: 'POST',
      body: { username, password },
    })
    queryClient.clear()
    session.set(tokens)
  }
  function logout() {
    session.clear()
    queryClient.clear()
  }
  return (
    <AuthContext.Provider
      value={{
        user: state.active ? me.data : undefined,
        loading: state.active && me.isPending,
        active: state.active,
        expired: state.expired,
        error: me.error,
        retry: () => {
          void me.refetch()
        },
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is required')
  return auth
}
