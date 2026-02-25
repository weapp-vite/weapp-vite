import { isReactive, isRef, reactive } from '../../reactivity'

export interface InlineExpressionEntry {
  keys: string[]
  indexKeys?: string[]
  scopeResolvers?: Array<InlineExpressionScopeResolver | ((ctx: any, scope: Record<string, any>, event: any) => any) | undefined>
  fn: (ctx: any, scope: Record<string, any>, event: any) => any
}

interface InlineExpressionScopeResolver {
  type: 'for-item'
  path: string
  indexKey: string
}

export type InlineExpressionMap = Record<string, InlineExpressionEntry>

export function decodeWxmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeDatasetIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function normalizeEventToken(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function resolveEventDatasetKey(baseKey: string, event: any): string | undefined {
  const eventType = typeof event?.type === 'string' ? event.type : ''
  const token = normalizeEventToken(eventType)
  if (!token) {
    return undefined
  }
  const camelToken = token.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
  if (!camelToken) {
    return undefined
  }
  return `${baseKey}${camelToken[0].toUpperCase()}${camelToken.slice(1)}`
}

export function resolveDatasetEventValue(
  dataset: Record<string, any>,
  baseKey: string,
  event: any,
): any {
  const specificKey = resolveEventDatasetKey(baseKey, event)
  if (specificKey && dataset?.[specificKey] !== undefined) {
    return dataset[specificKey]
  }
  return dataset?.[baseKey]
}

function shouldUseDetailPayload(dataset: Record<string, any>, event: any): boolean {
  const flag = resolveDatasetEventValue(dataset, 'wvEventDetail', event)
  return flag === true || flag === 1 || flag === '1' || flag === 'true'
}

function resolveInlineEventArg(event: any, dataset: Record<string, any>): any {
  if (!shouldUseDetailPayload(dataset, event)) {
    return event
  }
  if (!event || typeof event !== 'object' || !('detail' in event)) {
    return event
  }
  return (event as any).detail === undefined ? event : (event as any).detail
}

function getByPath(target: any, path: string) {
  if (!path) {
    return undefined
  }
  const segments = path.split('.').filter(Boolean)
  let current = isRef(target) ? target.value : target
  for (const segment of segments) {
    if (isRef(current)) {
      current = current.value
    }
    if (current == null) {
      return undefined
    }
    current = current[segment]
  }
  if (isRef(current)) {
    return current.value
  }
  return current
}

function normalizeResolvedScopeValue(value: any) {
  if (value == null || typeof value !== 'object') {
    return value
  }
  if (isRef(value) || isReactive(value)) {
    return value
  }
  try {
    return reactive(value)
  }
  catch {
    return value
  }
}

export function runInlineExpression(
  ctx: any,
  expr: unknown,
  event: any,
  inlineMap?: InlineExpressionMap,
) {
  const dataset = (event?.currentTarget as any)?.dataset ?? (event?.target as any)?.dataset ?? {}
  const inlineEvent = resolveInlineEventArg(event, dataset)
  const inlineId = resolveDatasetEventValue(dataset, 'wvInlineId', event)
  if (inlineId && inlineMap) {
    const entry = inlineMap[inlineId]
    if (entry && typeof entry.fn === 'function') {
      const scope: Record<string, any> = {}
      const keys = Array.isArray(entry.keys) ? entry.keys : []
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        scope[key] = dataset?.[`wvS${i}`]
      }
      const indexKeys = Array.isArray(entry.indexKeys) ? entry.indexKeys : []
      for (let i = 0; i < indexKeys.length; i += 1) {
        const indexKey = indexKeys[i]
        const indexValue = normalizeDatasetIndex(dataset?.[`wvI${i}`])
        if (indexValue !== undefined) {
          scope[indexKey] = indexValue
        }
      }
      const scopeResolvers = Array.isArray(entry.scopeResolvers) ? entry.scopeResolvers : []
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const resolver = scopeResolvers[i]
        try {
          let resolved: any
          if (typeof resolver === 'function') {
            resolved = resolver(ctx, scope, inlineEvent)
          }
          else if (resolver && typeof resolver === 'object' && resolver.type === 'for-item') {
            const index = scope[resolver.indexKey]
            const list = getByPath(ctx, resolver.path)
            resolved = list?.[index]
          }
          else {
            continue
          }
          if (resolved !== undefined) {
            scope[key] = normalizeResolvedScopeValue(resolved)
          }
        }
        catch {
          // 解析失败时保持 dataset 快照回退。
        }
      }
      const result = entry.fn(ctx, scope, inlineEvent)
      if (typeof result === 'function') {
        return result.call(ctx, inlineEvent)
      }
      return result
    }
  }

  const datasetHandler = resolveDatasetEventValue(dataset, 'wvHandler', event)
  const handlerName = typeof expr === 'string' && expr
    ? expr
    : (typeof datasetHandler === 'string' ? datasetHandler : undefined)
  if (!handlerName) {
    return undefined
  }
  const argsRaw = resolveDatasetEventValue(dataset, 'wvArgs', event)
  let args: any[] = []
  if (Array.isArray(argsRaw)) {
    args = argsRaw
  }
  else if (typeof argsRaw === 'string') {
    try {
      args = JSON.parse(argsRaw)
    }
    catch {
      try {
        args = JSON.parse(decodeWxmlEntities(argsRaw))
      }
      catch {
        args = []
      }
    }
  }
  if (!Array.isArray(args)) {
    args = []
  }
  const resolvedArgs = args.map((item: any) => item === '$event' ? inlineEvent : item)
  const handler = (ctx as any)?.[handlerName]
  if (typeof handler === 'function') {
    return handler.apply(ctx, resolvedArgs)
  }
  return undefined
}
