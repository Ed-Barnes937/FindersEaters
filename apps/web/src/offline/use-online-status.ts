import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * Whether the browser is online, following the same signal that pauses and
 * resumes the mutation queue. State only: the visible offline indicator waits
 * for its design (docs/design-reference).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
  )
}
