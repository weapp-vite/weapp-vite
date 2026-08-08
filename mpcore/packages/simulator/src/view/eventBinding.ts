export interface MiniProgramEventBinding {
  method: string
  stopAfter: boolean
}

interface EventBindingCandidate extends MiniProgramEventBinding {
  eventName: string
  priority: number
}

const LEGACY_EVENT_NAME_RE = /^\w+$/
const EVENT_BINDING_PREFIXES = [
  { prefix: 'bind:', priority: 0, stopAfter: false },
  { prefix: 'catch:', priority: 0, stopAfter: true },
  { prefix: 'bind', priority: 1, stopAfter: false },
  { prefix: 'catch', priority: 1, stopAfter: true },
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
    priority: definition.priority,
    stopAfter: definition.stopAfter,
  }
}

export function collectMiniProgramEventBindings(attributes: Record<string, string> = {}) {
  const bindings = new Map<string, MiniProgramEventBinding>()
  const priorities = new Map<string, number>()
  for (const [attributeName, method] of Object.entries(attributes)) {
    const candidate = parseEventBinding(attributeName, method)
    if (!candidate || candidate.priority < (priorities.get(candidate.eventName) ?? -1)) {
      continue
    }
    bindings.set(candidate.eventName, {
      method: candidate.method,
      stopAfter: candidate.stopAfter,
    })
    priorities.set(candidate.eventName, candidate.priority)
  }
  return bindings
}

export function resolveMiniProgramEventBinding(
  attributes: Record<string, string> | undefined,
  eventName: string,
) {
  return collectMiniProgramEventBindings(attributes).get(eventName) ?? null
}
