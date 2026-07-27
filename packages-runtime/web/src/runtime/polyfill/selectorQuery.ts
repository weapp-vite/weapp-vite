import type {
  SelectorQuery,
  SelectorQueryNodeCallback,
  SelectorQueryNodeFields,
  SelectorQueryNodesRef,
  SelectorQueryTask,
  SelectorTargetDescriptor,
} from './selectorQueryTypes'
import { resolveComponentPublicInstanceTarget } from '../component/publicInstance'

function isQueryRoot(value: unknown): value is ParentNode {
  if (!value || typeof value !== 'object') {
    return false
  }
  const target = value as {
    querySelector?: (selector: string) => unknown
    querySelectorAll?: (selector: string) => ArrayLike<unknown>
  }
  return typeof target.querySelector === 'function' && typeof target.querySelectorAll === 'function'
}

function resolveScopedQueryRoot(scope: unknown): ParentNode | undefined {
  const normalizedScope = resolveComponentPublicInstanceTarget(scope) ?? scope
  const scoped = normalizedScope as {
    renderRoot?: unknown
    shadowRoot?: unknown
    $el?: unknown
  } | undefined
  if (isQueryRoot(scoped?.renderRoot)) {
    return scoped?.renderRoot
  }
  if (isQueryRoot(scoped?.shadowRoot)) {
    return scoped?.shadowRoot
  }
  const publicElement = (resolveComponentPublicInstanceTarget(scoped?.$el) ?? scoped?.$el) as {
    renderRoot?: unknown
    shadowRoot?: unknown
  } | undefined
  if (isQueryRoot(publicElement?.renderRoot)) {
    return publicElement.renderRoot
  }
  if (isQueryRoot(publicElement?.shadowRoot)) {
    return publicElement.shadowRoot
  }
  if (isQueryRoot(scoped?.$el)) {
    return scoped?.$el
  }
  if (isQueryRoot(normalizedScope)) {
    return normalizedScope
  }
  return undefined
}

function resolveCurrentPageQueryRoot() {
  const getCurrentPages = (globalThis as {
    getCurrentPages?: () => unknown[]
  }).getCurrentPages
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  return resolveScopedQueryRoot(pages[pages.length - 1])
}

function resolveQueryRoot(scope: unknown): ParentNode | undefined {
  const scopedRoot = resolveScopedQueryRoot(scope)
  if (scopedRoot) {
    return scopedRoot
  }
  if (scope == null) {
    const currentPageRoot = resolveCurrentPageQueryRoot()
    if (currentPageRoot) {
      return currentPageRoot
    }
  }
  if (typeof document !== 'undefined' && isQueryRoot(document)) {
    return document
  }
  return undefined
}

function resolveViewportTarget() {
  if (typeof window !== 'undefined') {
    return window
  }
  return undefined
}

function resolveUpdateComplete(scope: unknown): PromiseLike<unknown> | undefined {
  const normalizedScope = resolveComponentPublicInstanceTarget(scope) ?? scope
  const scoped = normalizedScope as {
    updateComplete?: unknown
    $el?: unknown
  } | undefined
  const publicElement = (resolveComponentPublicInstanceTarget(scoped?.$el) ?? scoped?.$el) as {
    updateComplete?: unknown
  } | undefined
  const candidate = publicElement?.updateComplete ?? scoped?.updateComplete
  if (
    candidate
    && typeof candidate === 'object'
    && typeof (candidate as PromiseLike<unknown>).then === 'function'
  ) {
    return candidate as PromiseLike<unknown>
  }
  return undefined
}

function resolveQueryTargets(scope: unknown, target: SelectorTargetDescriptor): unknown[] {
  if (target.type === 'viewport') {
    const viewport = resolveViewportTarget()
    return viewport ? [viewport] : []
  }
  const root = resolveQueryRoot(scope)
  if (!root || !target.selector) {
    return []
  }
  const query = (queryRoot: ParentNode) => {
    if (target.multiple) {
      return Array.from(queryRoot.querySelectorAll(target.selector!))
    }
    const node = queryRoot.querySelector(target.selector!)
    return node ? [node] : []
  }
  const scopedTargets = query(root)
  if (scopedTargets.length > 0) {
    return scopedTargets
  }

  const scopedPublicElement = (scope as { $?: unknown, $el?: unknown } | undefined)?.$el
  const publicElement = (resolveComponentPublicInstanceTarget(scopedPublicElement) ?? scopedPublicElement) as {
    getRootNode?: () => unknown
  } | undefined
  if (!(scope && typeof scope === 'object' && '$' in scope)) {
    return []
  }

  if (typeof publicElement?.getRootNode === 'function') {
    let ancestorRoot = publicElement.getRootNode()
    const visited = new Set<unknown>()
    while (isQueryRoot(ancestorRoot) && !visited.has(ancestorRoot)) {
      visited.add(ancestorRoot)
      const ancestorTargets = query(ancestorRoot)
      if (ancestorTargets.length > 0) {
        return ancestorTargets
      }
      const host = (ancestorRoot as { host?: { getRootNode?: () => unknown } }).host
      ancestorRoot = host?.getRootNode?.()
    }
  }

  const currentPageRoot = resolveCurrentPageQueryRoot()
  if (currentPageRoot && currentPageRoot !== root) {
    return query(currentPageRoot)
  }
  return []
}

export function resolveSelectorTargets(scope: unknown, selector: string, multiple = false) {
  return resolveQueryTargets(scope, { type: 'node', selector, multiple })
}

function normalizeRectValue(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return value
}

function getViewportRect() {
  const runtimeWindow = typeof window !== 'undefined' ? window : undefined
  const width = normalizeRectValue(runtimeWindow?.innerWidth)
  const height = normalizeRectValue(runtimeWindow?.innerHeight)
  return {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
  }
}

function readNodeRect(node: unknown) {
  if (!node) {
    return null
  }
  if ((typeof window !== 'undefined' && node === window) || node === globalThis) {
    return getViewportRect()
  }
  const target = node as {
    getBoundingClientRect?: () => {
      left?: number
      top?: number
      right?: number
      bottom?: number
      width?: number
      height?: number
    }
  }
  if (typeof target.getBoundingClientRect !== 'function') {
    return null
  }
  const rect = target.getBoundingClientRect()
  const left = normalizeRectValue(rect.left)
  const top = normalizeRectValue(rect.top)
  const width = normalizeRectValue(rect.width)
  const height = normalizeRectValue(rect.height)
  const right = rect.right == null ? left + width : normalizeRectValue(rect.right)
  const bottom = rect.bottom == null ? top + height : normalizeRectValue(rect.bottom)
  return { left, top, right, bottom, width, height }
}

function readNodeScrollOffset(node: unknown) {
  if ((typeof window !== 'undefined' && node === window) || node === globalThis) {
    const runtimeWindow = (typeof window !== 'undefined'
      ? (window as unknown as Record<string, unknown>)
      : (globalThis as Record<string, unknown>))
    return {
      scrollLeft: normalizeRectValue(
        (runtimeWindow.pageXOffset as number | undefined) ?? (runtimeWindow.scrollX as number | undefined),
      ),
      scrollTop: normalizeRectValue(
        (runtimeWindow.pageYOffset as number | undefined) ?? (runtimeWindow.scrollY as number | undefined),
      ),
    }
  }
  const target = node as {
    scrollLeft?: number
    scrollTop?: number
  }
  return {
    scrollLeft: normalizeRectValue(target?.scrollLeft),
    scrollTop: normalizeRectValue(target?.scrollTop),
  }
}

function readNodeFields(node: unknown, fields: SelectorQueryNodeFields) {
  if (!node) {
    return null
  }
  const result: Record<string, any> = {}
  const element = node as HTMLElement

  if (fields.id) {
    const elementWithId = element as { id?: string, getAttribute?: (name: string) => string | null }
    result.id = elementWithId.id ?? elementWithId.getAttribute?.('id') ?? ''
  }
  if (fields.dataset) {
    result.dataset = { ...(element.dataset ?? {}) }
  }
  if (fields.rect || fields.size) {
    const rect = readNodeRect(node)
    if (rect) {
      if (fields.rect) {
        result.left = rect.left
        result.top = rect.top
        result.right = rect.right
        result.bottom = rect.bottom
      }
      if (fields.size) {
        result.width = rect.width
        result.height = rect.height
      }
    }
  }
  if (fields.scrollOffset) {
    Object.assign(result, readNodeScrollOffset(node))
  }
  if (fields.properties?.length) {
    for (const key of fields.properties) {
      result[key] = (node as Record<string, unknown>)[key]
    }
  }
  if (fields.computedStyle?.length && typeof getComputedStyle === 'function' && node instanceof HTMLElement) {
    const style = getComputedStyle(node)
    for (const key of fields.computedStyle) {
      result[key] = style.getPropertyValue(key)
    }
  }
  if (fields.node) {
    result.node = node
  }
  if (fields.context) {
    result.context = node
  }
  return result
}

function mapQueryResult(target: SelectorTargetDescriptor, items: unknown[], mapper: (node: unknown) => any) {
  if (target.type === 'node' && target.multiple) {
    return items.map(item => mapper(item))
  }
  const first = items[0]
  if (!first) {
    return null
  }
  return mapper(first)
}

function runQueryTask(scope: unknown, task: SelectorQueryTask) {
  const targets = resolveQueryTargets(scope, task.target)
  if (task.type === 'boundingClientRect') {
    return mapQueryResult(task.target, targets, node => readNodeRect(node))
  }
  if (task.type === 'scrollOffset') {
    return mapQueryResult(task.target, targets, node => readNodeScrollOffset(node))
  }
  if (task.type === 'fields') {
    return mapQueryResult(task.target, targets, node => readNodeFields(node, task.fields))
  }
  return mapQueryResult(task.target, targets, node => ({ node }))
}

function createNodesRef(
  tasks: SelectorQueryTask[],
  queryApi: SelectorQuery,
  target: SelectorTargetDescriptor,
): SelectorQueryNodesRef {
  return {
    boundingClientRect(callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'boundingClientRect', target, callback })
      return queryApi
    },
    scrollOffset(callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'scrollOffset', target, callback })
      return queryApi
    },
    fields(fields: SelectorQueryNodeFields, callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'fields', target, fields, callback })
      return queryApi
    },
    node(callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'node', target, callback })
      return queryApi
    },
  }
}

export function createSelectorQueryBridge() {
  let scope: unknown
  const tasks: SelectorQueryTask[] = []

  const queryApi: SelectorQuery = {
    in(context?: unknown) {
      scope = context
      return queryApi
    },
    select(selector: string) {
      return createNodesRef(tasks, queryApi, { type: 'node', selector, multiple: false })
    },
    selectAll(selector: string) {
      return createNodesRef(tasks, queryApi, { type: 'node', selector, multiple: true })
    },
    selectViewport() {
      return createNodesRef(tasks, queryApi, { type: 'viewport' })
    },
    exec(callback?: (result: any[]) => void) {
      const pendingTasks = tasks.splice(0)
      const run = () => {
        const result = pendingTasks.map((task) => {
          const value = runQueryTask(scope, task)
          task.callback?.(value)
          return value
        })
        callback?.(result)
      }
      const updateComplete = resolveUpdateComplete(scope)
      if (updateComplete) {
        void Promise.resolve(updateComplete).then(run)
      }
      else {
        run()
      }
      return queryApi
    },
  }

  return queryApi
}
