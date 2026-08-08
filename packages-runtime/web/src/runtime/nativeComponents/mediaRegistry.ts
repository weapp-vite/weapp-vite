export type NativeMediaKind = 'canvas' | 'video'

type NativeMediaElement = HTMLCanvasElement | HTMLVideoElement

const mediaElements = new Map<NativeMediaKind, Map<string, NativeMediaElement[]>>()
const mediaRegistrations = new WeakMap<NativeMediaElement, {
  kind: NativeMediaKind
  ids: string[]
}>()

function normalizeMediaIds(ids: Iterable<string | null | undefined>) {
  return Array.from(new Set(
    Array.from(ids, id => String(id ?? '').trim()).filter(Boolean),
  ))
}

export function unregisterNativeMediaElement(element: NativeMediaElement) {
  const registration = mediaRegistrations.get(element)
  if (!registration) {
    return
  }
  const kindElements = mediaElements.get(registration.kind)!
  for (const id of registration.ids) {
    const elements = kindElements.get(id)!
    const index = elements.lastIndexOf(element)
    elements.splice(index, 1)
    if (elements.length === 0) {
      kindElements.delete(id)
    }
  }
  if (kindElements.size === 0) {
    mediaElements.delete(registration.kind)
  }
  mediaRegistrations.delete(element)
}

export function registerNativeMediaElement(
  kind: NativeMediaKind,
  ids: Iterable<string | null | undefined>,
  element: NativeMediaElement,
) {
  unregisterNativeMediaElement(element)
  const normalizedIds = normalizeMediaIds(ids)
  if (normalizedIds.length === 0) {
    return
  }
  let kindElements = mediaElements.get(kind)
  if (!kindElements) {
    kindElements = new Map()
    mediaElements.set(kind, kindElements)
  }
  for (const id of normalizedIds) {
    const elements = kindElements.get(id) ?? []
    elements.push(element)
    kindElements.set(id, elements)
  }
  mediaRegistrations.set(element, { kind, ids: normalizedIds })
}

export function resolveNativeMediaElement<T extends NativeMediaElement>(kind: NativeMediaKind, id: string) {
  const normalizedId = String(id).trim()
  const elements = mediaElements.get(kind)?.get(normalizedId)
  return elements?.[elements.length - 1] as T | undefined
}
