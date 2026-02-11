import type { InternalRuntimeState } from '../../types'

function normalizeAttrKey(name: string): string {
  return name
    .replace(/-([a-z0-9])/gi, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, char => char.toLowerCase())
}

function shouldSkipAttrKey(rawKey: string): boolean {
  const key = rawKey.trim()
  if (!key) {
    return true
  }
  if (
    key === '__wvAttrs'
    || key === '__wvSlotOwnerId'
    || key === '__wvSlotScope'
    || key === '__wvSlotProps'
    || key === '__wvSlotPropsData'
    || key === 'class'
    || key === 'style'
    || key === 'slot'
    || key === 'key'
    || key === 'ref'
    || key === 'is'
    || key === 'data-is'
  ) {
    return true
  }
  if (key.startsWith('__wv')) {
    return true
  }
  if (key.startsWith('data-wv-')) {
    return true
  }
  if (key.startsWith('on') && key.length > 2 && /[A-Z]/.test(key[2] ?? '')) {
    return true
  }
  if (key.startsWith('bind') || key.startsWith('catch') || key.startsWith('capture-')) {
    return true
  }
  return false
}

function toDeclaredPropNameSet(properties: Record<string, any> | undefined): Set<string> {
  const declared = new Set<string>()
  if (!properties || typeof properties !== 'object') {
    return declared
  }
  for (const key of Object.keys(properties)) {
    if (!key || key.startsWith('__wv')) {
      continue
    }
    declared.add(key)
    declared.add(normalizeAttrKey(key))
  }
  return declared
}

function fromArrayPayload(payload: unknown): Record<string, any> {
  if (!Array.isArray(payload)) {
    return {}
  }
  const attrs: Record<string, any> = Object.create(null)
  for (let index = 0; index < payload.length; index += 2) {
    const key = payload[index]
    if (typeof key !== 'string') {
      continue
    }
    attrs[key] = payload[index + 1]
  }
  return attrs
}

function toAttrsRecord(payload: unknown): Record<string, any> {
  if (Array.isArray(payload)) {
    return fromArrayPayload(payload)
  }
  if (payload && typeof payload === 'object') {
    return payload as Record<string, any>
  }
  return {}
}

export function resolveRuntimeAttrs(
  properties: Record<string, any> | undefined,
  attrsPayload: unknown,
): Record<string, any> {
  const declaredPropNameSet = toDeclaredPropNameSet(properties)
  const source = toAttrsRecord(attrsPayload)
  const attrs: Record<string, any> = Object.create(null)

  for (const [rawKey, value] of Object.entries(source)) {
    if (shouldSkipAttrKey(rawKey)) {
      continue
    }
    const normalizedKey = normalizeAttrKey(rawKey)
    if (!normalizedKey || declaredPropNameSet.has(rawKey) || declaredPropNameSet.has(normalizedKey)) {
      continue
    }
    attrs[normalizedKey] = value
  }

  return attrs
}

export function syncRuntimeAttrs(instance: InternalRuntimeState) {
  const setupContext = (instance as any).__wevuSetupContext
  if (!setupContext || typeof setupContext !== 'object') {
    return
  }
  const properties = (instance as any).properties
  const attrsPayload = properties && typeof properties === 'object'
    ? (properties as any).__wvAttrs
    : undefined
  const nextAttrs = resolveRuntimeAttrs(properties as any, attrsPayload)
  const attrs = setupContext.attrs
  if (!attrs || typeof attrs !== 'object') {
    setupContext.attrs = nextAttrs
    return
  }

  const existingKeys = Object.keys(attrs)
  for (const key of existingKeys) {
    if (!Object.prototype.hasOwnProperty.call(nextAttrs, key)) {
      delete attrs[key]
    }
  }
  for (const [key, value] of Object.entries(nextAttrs)) {
    attrs[key] = value
  }
}
