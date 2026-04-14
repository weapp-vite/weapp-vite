import { resolveTextDecoderConstructor, resolveTextEncoderConstructor } from './constructors'

export interface RequestGlobalsEventLike {
  type: string
  target?: unknown
  currentTarget?: unknown
}

export interface RequestGlobalsEventTargetLike {
  addEventListener: (type: string, listener: (event: RequestGlobalsEventLike) => void) => void
  removeEventListener: (type: string, listener: (event: RequestGlobalsEventLike) => void) => void
  dispatchEvent: (event: RequestGlobalsEventLike) => boolean
}

type EventListener = (event: RequestGlobalsEventLike) => void

export class RequestGlobalsEventTarget implements RequestGlobalsEventTargetLike {
  private readonly listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: string, listener: EventListener) {
    const set = this.listeners.get(type) ?? new Set<EventListener>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatchEvent(event: RequestGlobalsEventLike) {
    const payload = {
      ...event,
      target: event.target ?? this,
      currentTarget: event.currentTarget ?? this,
    }

    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(payload)
    }

    const handlerKey = `on${event.type}` as keyof this
    const handler = this[handlerKey]
    if (typeof handler === 'function') {
      ;(handler as EventListener)(payload)
    }

    return true
  }
}

export function resolveRequestGlobalsHost() {
  if (typeof globalThis !== 'undefined') {
    return globalThis as Record<string, any>
  }
  return {} as Record<string, any>
}

function isRequestGlobalsHostCandidate(value: unknown): value is Record<string, any> {
  return value != null && (typeof value === 'object' || typeof value === 'function')
}

function pushRequestGlobalsHost(
  hosts: Array<Record<string, any>>,
  candidate: unknown,
) {
  if (!isRequestGlobalsHostCandidate(candidate)) {
    return
  }
  if (!hosts.includes(candidate)) {
    hosts.push(candidate)
  }
}

export function resolveRequestGlobalsHosts() {
  const hosts: Array<Record<string, any>> = []
  const primaryHost = resolveRequestGlobalsHost()
  pushRequestGlobalsHost(hosts, primaryHost)

  for (const name of ['global', 'self', 'window']) {
    pushRequestGlobalsHost(hosts, primaryHost[name])
  }

  for (const key of ['wx', 'my', 'tt']) {
    pushRequestGlobalsHost(hosts, primaryHost[key])
  }

  return hosts
}

export function installRequestGlobalBinding(name: string, value: unknown) {
  if (!name) {
    return
  }

  try {
    const host = resolveRequestGlobalsHost()
    host[name] = value
  }
  catch {
  }
}

export function cloneArrayBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

export function cloneArrayBufferView(view: ArrayBufferView) {
  const copied = new Uint8Array(view.byteLength)
  copied.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
  return copied.buffer
}

export function encodeTextFallback(value: string) {
  const normalized = String(value)
  const binary = unescape(encodeURIComponent(normalized))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function encodeText(value: string) {
  const TextEncoderConstructor = resolveTextEncoderConstructor()
  if (TextEncoderConstructor) {
    return new TextEncoderConstructor().encode(value).buffer
  }
  return encodeTextFallback(value)
}

export function decodeTextFallback(value: ArrayBuffer) {
  const bytes = new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  try {
    return decodeURIComponent(escape(binary))
  }
  catch {
    return binary
  }
}

export function decodeText(value: ArrayBuffer) {
  const TextDecoderConstructor = resolveTextDecoderConstructor()
  if (TextDecoderConstructor) {
    return new TextDecoderConstructor().decode(value)
  }
  return decodeTextFallback(value)
}

export function normalizeHeaderName(name: string) {
  return name.trim().toLowerCase()
}
