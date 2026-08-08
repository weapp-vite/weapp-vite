import type { HostEventHandler, MiniProgramEventLike } from './types'
import { HostElement } from './hostTree'

interface EventHostRoot {
  flush: () => void
  getNode: (sid: string) => unknown
}

function toEventPropName(type: string) {
  return `on${type.charAt(0).toUpperCase()}${type.slice(1)}`
}

export function dispatchHostEvent(root: EventHostRoot, nativeEvent: MiniProgramEventLike) {
  const rawSid = nativeEvent.currentTarget?.dataset?.sid
  if (typeof rawSid !== 'string') {
    return
  }

  const target = root.getNode(rawSid)
  if (!(target instanceof HostElement)) {
    return
  }

  const path: HostElement[] = []
  let current: HostElement | null = target
  while (current) {
    path.push(current)
    current = current.parent instanceof HostElement ? current.parent : null
  }

  let stopped = false
  const event = {
    currentTarget: target,
    detail: nativeEvent.detail ?? {},
    nativeEvent,
    stopPropagation: () => {
      stopped = true
    },
    target,
    type: nativeEvent.type,
  }
  const propName = toEventPropName(nativeEvent.type)

  for (const node of path.slice().reverse()) {
    const handler = node.props[`${propName}Capture`]
    if (typeof handler === 'function') {
      event.currentTarget = node
      ;(handler as HostEventHandler)(event)
    }
    if (stopped) {
      root.flush()
      return
    }
  }

  for (const node of path) {
    const handler = node.props[propName]
    if (typeof handler === 'function') {
      event.currentTarget = node
      ;(handler as HostEventHandler)(event)
    }
    if (stopped) {
      break
    }
  }
  root.flush()
}
