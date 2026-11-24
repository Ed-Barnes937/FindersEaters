import { onlineManager } from '@tanstack/react-query'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'

import { useOnlineStatus } from './use-online-status.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('reports the online state and follows it', () => {
  onlineManager.setOnline(true)
  const el = document.createElement('div')
  function Probe() {
    return createElement('span', null, useOnlineStatus() ? 'online' : 'offline')
  }
  const root = createRoot(el)
  act(() => root.render(createElement(Probe)))
  expect(el.textContent).toBe('online')

  act(() => onlineManager.setOnline(false))
  expect(el.textContent).toBe('offline')
  act(() => root.unmount())
})
