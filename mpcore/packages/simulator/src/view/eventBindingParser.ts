import type { MiniProgramEventBinding } from './eventBinding'

export interface MiniProgramEventPhases {
  capture?: MiniProgramEventBinding
  bubble?: MiniProgramEventBinding
}

interface EventBindingCandidate extends MiniProgramEventBinding {
  eventName: string
  phase: keyof MiniProgramEventPhases
  priority: number
}

const LEGACY_EVENT_NAME_RE = /^\w+$/
const EVENT_BINDING_PREFIXES = [
  { prefix: 'capture-bind:', priority: 0, stopAfter: false, phase: 'capture' },
  { prefix: 'capture-catch:', priority: 0, stopAfter: true, phase: 'capture' },
  { prefix: 'capture-bind', priority: 1, stopAfter: false, phase: 'capture' },
  { prefix: 'capture-catch', priority: 1, stopAfter: true, phase: 'capture' },
  { prefix: 'bind:', priority: 0, stopAfter: false, phase: 'bubble' },
  { prefix: 'catch:', priority: 0, stopAfter: true, phase: 'bubble' },
  { prefix: 'bind', priority: 1, stopAfter: false, phase: 'bubble' },
  { prefix: 'catch', priority: 1, stopAfter: true, phase: 'bubble' },
] as const

function parseEventBinding(attributeName: string, method: string): EventBindingCandidate | null {
  const definition = EVENT_BINDING_PREFIXES.find(item => attributeName.startsWith(item.prefix))
  if (!definition) {
    return null
  }
  const eventName = attributeName.slice(definition.prefix.length)
  if (!eventName || (!definition.prefix.endsWith(':') && !LEGACY_EVENT_NAME_RE.test(eventName))) {
    return null
  }
  return {
    eventName,
    method,
    phase: definition.phase,
    priority: definition.priority,
    stopAfter: definition.stopAfter,
  }
}

export function collectEventBindings(attributes: Record<string, string> = {}, includeCapture = true) {
  const eventBindings = new Map<string, MiniProgramEventBinding>()
  let captureEventBindings: Map<string, MiniProgramEventBinding> | undefined
  const priorities = new Map<string, Partial<Record<keyof MiniProgramEventPhases, number>>>()
  for (const [attributeName, method] of Object.entries(attributes)) {
    const candidate = parseEventBinding(attributeName, method)
    if (!candidate || (!includeCapture && candidate.phase === 'capture')) {
      continue
    }
    const eventPriorities = priorities.get(candidate.eventName) ?? {}
    if (candidate.priority < (eventPriorities[candidate.phase] ?? -1)) {
      continue
    }
    const bindings = candidate.phase === 'bubble'
      ? eventBindings
      : captureEventBindings ??= new Map()
    bindings.set(candidate.eventName, {
      method: candidate.method,
      stopAfter: candidate.stopAfter,
    })
    eventPriorities[candidate.phase] = candidate.priority
    priorities.set(candidate.eventName, eventPriorities)
  }
  return { eventBindings, captureEventBindings }
}

/** 单事件查询只保留命中的绑定，原生交互不构造整张事件表。 */
export function resolveEventBindingPhases(
  attributes: Record<string, string> | undefined,
  eventName: string,
  includeCapture = true,
): MiniProgramEventPhases | null {
  if (!attributes) {
    return null
  }
  let bindings: MiniProgramEventPhases | null = null
  let bubblePriority = -1
  let capturePriority = -1
  for (const [attributeName, method] of Object.entries(attributes)) {
    const candidate = parseEventBinding(attributeName, method)
    if (!candidate || candidate.eventName !== eventName || (!includeCapture && candidate.phase === 'capture')) {
      continue
    }
    const priority = candidate.phase === 'bubble' ? bubblePriority : capturePriority
    if (candidate.priority < priority) {
      continue
    }
    bindings ??= {}
    bindings[candidate.phase] = { method: candidate.method, stopAfter: candidate.stopAfter }
    if (candidate.phase === 'bubble') {
      bubblePriority = candidate.priority
    }
    else {
      capturePriority = candidate.priority
    }
  }
  return bindings
}
