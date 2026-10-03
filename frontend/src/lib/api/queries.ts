import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status >= 500),
    },
    mutations: { retry: false },
  },
})
export const keys = {
  me: (generation: number) => ['auth', generation] as const,
  summary: ['summary'] as const,
  repairs: ['repairs'] as const,
  repairList: (query: string) => ['repairs', 'list', query] as const,
  repair: (id: number) => ['repairs', 'detail', id] as const,
  history: (id: number) => ['repairs', 'history', id] as const,
  customers: ['customers'] as const,
  customerList: (search: string) => ['customers', 'list', search] as const,
  devices: (id: number) => ['customers', id, 'devices'] as const,
  customerHistory: (id: number, page: number) => ['customers', id, 'history', page] as const,
  staff: ['staff'] as const,
  notifications: ['notifications'] as const,
  notificationList: (query: string) => ['notifications', 'list', query] as const,
  models: (search: string, page: number) => ['models', search, page] as const,
}
export async function invalidateRepairs() {
  await Promise.all(
    [keys.repairs, keys.summary, keys.customers].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  )
}
