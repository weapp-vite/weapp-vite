export interface InlineExpressionEntry {
  keys: string[]
  fn: (ctx: any, scope: Record<string, any>, event: any) => any
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

export function runInlineExpression(
  ctx: any,
  expr: unknown,
  event: any,
  inlineMap?: InlineExpressionMap,
) {
  const dataset = (event?.currentTarget as any)?.dataset ?? (event?.target as any)?.dataset ?? {}
  const inlineId = dataset?.wvInlineId
  if (inlineId && inlineMap) {
    const entry = inlineMap[inlineId]
    if (entry && typeof entry.fn === 'function') {
      const scope: Record<string, any> = {}
      const keys = Array.isArray(entry.keys) ? entry.keys : []
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        scope[key] = dataset?.[`wvS${i}`]
      }
      const result = entry.fn(ctx, scope, event)
      if (typeof result === 'function') {
        return result.call(ctx, event)
      }
      return result
    }
  }

  const handlerName = typeof expr === 'string' ? expr : undefined
  if (!handlerName) {
    return undefined
  }
  const argsRaw = dataset?.wvArgs
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
  const resolvedArgs = args.map((item: any) => item === '$event' ? event : item)
  const handler = (ctx as any)?.[handlerName]
  if (typeof handler === 'function') {
    return handler.apply(ctx, resolvedArgs)
  }
  return undefined
}
