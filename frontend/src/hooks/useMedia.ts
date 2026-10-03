import { useSyncExternalStore } from 'react'
export function useMedia(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const media = matchMedia(query)
      media.addEventListener('change', callback)
      return () => media.removeEventListener('change', callback)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}
