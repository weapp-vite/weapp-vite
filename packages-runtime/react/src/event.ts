import type { HostEventHandler, MiniProgramEventLike } from './types'
import { WEAPP_REACT_EVENT_DATASET_KEY } from '@weapp-core/constants'
import { HostElement } from './hostTree'

interface EventHostRoot {
  flush: () => void
  getNode: (sid: string) => unknown
}

function normalizeEventType(type: string) {
  return type
    .replace(/^(?:capture[-:]*)?(?:bind|catch)[-:]*/i, '')
    .replace(/[-_:]/g, '')
    .toLowerCase()
}

function findEventProp(props: Record<string, unknown>, type: string, capture: boolean) {
  const suffix = capture ? 'Capture' : ''
  const normalizedType = normalizeEventType(type)
  return Object.keys(props).find((name) => {
    if (!name.startsWith('on') || (capture ? !name.endsWith(suffix) : name.endsWith('Capture'))) {
      return false
    }
    const eventName = name.slice(2, suffix ? -suffix.length : undefined)
    return normalizeEventType(eventName) === normalizedType
  })
}

export function dispatchHostEvent(root: EventHostRoot, nativeEvent: MiniProgramEventLike) {
  const rawSid = nativeEvent.currentTarget?.dataset?.[WEAPP_REACT_EVENT_DATASET_KEY]
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
      nativeEvent.stopPropagation?.()
    },
    target,
    type: nativeEvent.type,
  }
  for (const node of path.slice().reverse()) {
    const propName = findEventProp(node.props, nativeEvent.type, true)
    if (!propName) {
      continue
    }
    const handler = node.props[propName]
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
    const propName = findEventProp(node.props, nativeEvent.type, false)
    if (!propName) {
      continue
    }
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
