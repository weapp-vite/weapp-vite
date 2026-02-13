import type { ComponentPublicInstance } from './component'
import type { TemplateScope } from './template'
import { getRuntimeExecutionMode, warnRuntimeExecutionOnce } from './execution'
import { emitRuntimeWarning } from './warning'

export interface RenderContext {
  instance: ComponentPublicInstance
  eval: (expression: string, scope: TemplateScope, wxs?: Record<string, any>) => any
  createScope: (parent: TemplateScope, locals?: Record<string, any>) => TemplateScope
  mergeScope: (parent: TemplateScope, data?: any) => TemplateScope
  normalizeList: (value: any) => any[]
  key: (rawKey: string, item: any, index: number, scope: TemplateScope, wxs?: Record<string, any>) => any
  renderTemplate: (templates: Record<string, any>, name: any, scope: TemplateScope, ctx: RenderContext) => any
  event: (eventName: string, handlerName: any, scope: TemplateScope, wxs?: Record<string, any>, flags?: { catch?: boolean, capture?: boolean }) => (event: Event) => void
  createWxsModule: (code: string, id: string, requireMap?: Record<string, any>) => Record<string, any>
}

const expressionCache = new Map<string, (scope: TemplateScope) => any>()

function createScope(initial?: TemplateScope) {
  return Object.assign(Object.create(null), initial ?? {})
}

function createChildScope(parent: TemplateScope, locals?: Record<string, any>) {
  return Object.assign(Object.create(parent), locals ?? {})
}

function evaluateExpression(expression: string, scope: TemplateScope) {
  if (!expression) {
    return undefined
  }
  const trimmed = expression.trim()
  if (!trimmed) {
    return undefined
  }
  let evaluator = expressionCache.get(trimmed)
  if (!evaluator) {
    try {
      // eslint-disable-next-line no-new-func -- dynamic expressions are required for template evaluation
      evaluator = new Function('scope', `with(scope){ return (${trimmed}); }`) as (scope: TemplateScope) => any
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const mode = getRuntimeExecutionMode()
      if (mode === 'safe') {
        warnRuntimeExecutionOnce(
          `safe-expression-parse:${trimmed}`,
          `[@weapp-vite/web] safe 模式下忽略表达式解析错误 "${trimmed}": ${reason}`,
        )
        evaluator = () => undefined
      }
      else {
        throw new SyntaxError(`[@weapp-vite/web] 无法解析表达式 "${trimmed}": ${reason}`)
      }
    }
    if (evaluator) {
      expressionCache.set(trimmed, evaluator)
    }
  }
  try {
    return evaluator?.(scope)
  }
  catch (error) {
    const mode = getRuntimeExecutionMode()
    if (mode === 'strict') {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`[@weapp-vite/web] strict 模式下表达式执行失败 "${trimmed}": ${reason}`)
    }
    if (mode === 'safe') {
      const reason = error instanceof Error ? error.message : String(error)
      warnRuntimeExecutionOnce(
        `safe-expression-runtime:${trimmed}`,
        `[@weapp-vite/web] safe 模式下忽略表达式执行错误 "${trimmed}": ${reason}`,
      )
    }
    return undefined
  }
}

function normalizeList(value: any): any[] {
  if (Array.isArray(value)) {
    return value
  }
  if (value == null) {
    return []
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const length = Math.max(0, Math.floor(value))
    return Array.from({ length }, (_, index) => index)
  }
  if (typeof value === 'object') {
    return Object.values(value)
  }
  return []
}

function normalizeKey(rawKey: string, item: any, index: number, scope: TemplateScope) {
  const key = rawKey?.trim()
  if (!key) {
    if (item != null && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
      return item
    }
    return index
  }
  if (key === '*this') {
    return item
  }
  if (key.includes('{{') && key.includes('}}')) {
    const expr = key.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '')
    return evaluateExpression(expr, scope)
  }
  if (!/[.[()]/.test(key) && item && typeof item === 'object' && key in item) {
    return (item as Record<string, any>)[key]
  }
  return evaluateExpression(key, scope)
}

function createEventHandler(
  instance: ComponentPublicInstance,
  methods: Record<string, (event: any) => any>,
  eventName: string,
  handlerRef: string | ((event: any) => any),
  flags?: { catch?: boolean },
) {
  const handler = typeof handlerRef === 'function'
    ? handlerRef
    : methods[handlerRef] ?? (instance as Record<string, any>)[handlerRef]
  if (typeof handler !== 'function') {
    return () => {}
  }
  return (nativeEvent: Event) => {
    if (flags?.catch) {
      nativeEvent.stopPropagation()
    }
    const target = nativeEvent.target as HTMLElement | null
    const currentTarget = nativeEvent.currentTarget as HTMLElement | null
    const dataset = currentTarget?.dataset ?? {}
    const syntheticEvent = {
      type: eventName,
      timeStamp: nativeEvent.timeStamp,
      detail: (nativeEvent as CustomEvent).detail ?? (nativeEvent as InputEvent).data ?? undefined,
      target: {
        dataset: target?.dataset ?? dataset,
      },
      currentTarget: {
        dataset,
      },
      originalEvent: nativeEvent,
    }
    handler.call(instance, syntheticEvent)
  }
}

function createWxsModule(code: string, id: string, requireMap?: Record<string, any>) {
  const module = { exports: {} as Record<string, any> }
  const exports = module.exports
  const getRegExp = (pattern: string, flags?: string) => new RegExp(pattern, flags)
  const getDate = (value?: string | number | Date) => (value == null ? new Date() : new Date(value))
  const require = (request: string) => requireMap?.[request]
  try {
    // eslint-disable-next-line no-new-func -- run in isolated module scope
    const runner = new Function('module', 'exports', 'require', 'getRegExp', 'getDate', code)
    runner(module, exports, require, getRegExp, getDate)
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const mode = getRuntimeExecutionMode()
    if (mode === 'safe') {
      warnRuntimeExecutionOnce(
        `safe-wxs-runtime:${id}`,
        `[@weapp-vite/web] safe 模式下忽略 WXS 执行错误: ${id} ${reason}`,
      )
      return {}
    }
    throw new Error(`[@weapp-vite/web] WXS 执行失败: ${id} ${reason}`)
  }
  return module.exports
}

export function createRenderContext(
  instance: ComponentPublicInstance,
  methods: Record<string, (event: any) => any>,
): RenderContext {
  const warnMissingTemplate = (name: string) => {
    emitRuntimeWarning(`[@weapp-vite/web] 未找到模板: ${name}`, {
      key: `template-missing:${name}`,
      context: 'runtime:template',
    })
  }

  return {
    instance,
    eval: (expression, scope, wxs) => {
      const baseScope = scope ?? createScope()
      const renderScope = wxs ? createChildScope(baseScope, wxs) : baseScope
      return evaluateExpression(expression, renderScope)
    },
    createScope: (parent, locals) => createChildScope(parent, locals),
    mergeScope: (parent, data) => {
      const baseScope = parent ?? createScope()
      if (!data || typeof data !== 'object') {
        return baseScope
      }
      return createChildScope(baseScope, data as Record<string, any>)
    },
    normalizeList,
    key: (rawKey, item, index, scope, wxs) => {
      const baseScope = scope ?? createScope()
      const renderScope = wxs ? createChildScope(baseScope, wxs) : baseScope
      return normalizeKey(rawKey, item, index, renderScope)
    },
    renderTemplate: (templates, name, scope, ctx) => {
      const resolvedName = typeof name === 'string' ? name : String(name)
      const template = templates?.[resolvedName]
      if (typeof template !== 'function') {
        warnMissingTemplate(resolvedName)
        return ''
      }
      return template(scope, ctx)
    },
    event: (eventName, handlerName, _scope, _wxs, flags) => {
      if (typeof handlerName === 'function') {
        return createEventHandler(instance, methods, eventName, handlerName, flags)
      }
      const resolvedHandler = String(handlerName ?? '')
      return createEventHandler(instance, methods, eventName, resolvedHandler, flags)
    },
    createWxsModule,
  }
}

export { createChildScope, createScope, evaluateExpression }
