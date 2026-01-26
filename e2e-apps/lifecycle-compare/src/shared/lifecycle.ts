export const PAGE_HOOKS = [
  'onLoad',
  'onShow',
  'onReady',
  'onHide',
  'onUnload',
  'onRouteDone',
  'onPullDownRefresh',
  'onReachBottom',
  'onPageScroll',
  'onResize',
  'onTabItemTap',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onSaveExitState',
]

export const COMPONENT_HOOKS = [
  'created',
  'attached',
  'ready',
  'moved',
  'detached',
  'error',
  'pageLifetimes.show',
  'pageLifetimes.hide',
  'pageLifetimes.resize',
]

export interface LifecycleEntry {
  hook: string
  order: number
  args: unknown
  snapshot: Record<string, unknown>
  skipped?: boolean
  source?: string
  componentKind?: string
}

export interface LifecycleData {
  __lifecycleLogs?: LifecycleEntry[]
  __lifecycleOrder?: number
  __lifecycleSeen?: Record<string, number>
  __lifecycleState?: Record<string, unknown>
  __lifecycleExpected?: string[]
  __lifecycleSummary?: {
    total: number
    seen: number
    skipped: number
    entries: number
    lastHook: string
  }
  __lifecyclePreview?: LifecycleEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeClone(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 4) {
    return '[max-depth]'
  }
  if (value == null || typeof value !== 'object') {
    return value
  }
  if (seen.has(value)) {
    return '[circular]'
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map(item => safeClone(item, depth + 1, seen))
  }
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'function') {
      continue
    }
    out[key] = safeClone(val, depth + 1, seen)
  }
  return out
}

function ensureLifecycleData(instance: { data?: LifecycleData, setData?: (data: LifecycleData) => void }) {
  const data = instance.data ?? (instance.data = {})
  data.__lifecycleLogs ??= []
  data.__lifecycleOrder ??= 0
  data.__lifecycleSeen ??= {}
  data.__lifecycleState ??= { tick: 0 }
  if (typeof instance.setData === 'function') {
    instance.setData({
      __lifecycleLogs: data.__lifecycleLogs,
      __lifecycleOrder: data.__lifecycleOrder,
      __lifecycleSeen: data.__lifecycleSeen,
      __lifecycleState: data.__lifecycleState,
    })
  }
  return data
}

function nextOrder(data: LifecycleData) {
  const current = typeof data.__lifecycleOrder === 'number' ? data.__lifecycleOrder : 0
  const next = current + 1
  data.__lifecycleOrder = next
  return next
}

function updateState(data: LifecycleData, hook: string) {
  const state = isRecord(data.__lifecycleState) ? data.__lifecycleState : {}
  const tick = typeof state.tick === 'number' ? state.tick + 1 : 1
  const nextState = {
    ...state,
    lastHook: hook,
    tick,
  }
  data.__lifecycleState = nextState
  return nextState
}

function buildSummary(data: LifecycleData, expected: string[]) {
  const seenMap = data.__lifecycleSeen ?? {}
  const seen = expected.reduce((count, hook) => count + (seenMap[hook] ? 1 : 0), 0)
  const total = expected.length
  const entries = data.__lifecycleLogs?.length ?? 0
  const lastHook = isRecord(data.__lifecycleState) && typeof data.__lifecycleState?.lastHook === 'string'
    ? (data.__lifecycleState?.lastHook as string)
    : ''
  return {
    total,
    seen,
    skipped: Math.max(0, total - seen),
    entries,
    lastHook,
  }
}

function updateSummary(instance: { data?: LifecycleData, setData?: (data: LifecycleData) => void }) {
  const data = instance.data
  const expected = data?.__lifecycleExpected
  if (!data || !Array.isArray(expected) || expected.length === 0) {
    return
  }
  const summary = buildSummary(data, expected)
  const preview = (data.__lifecycleLogs ?? []).slice(-6)
  data.__lifecycleSummary = summary
  data.__lifecyclePreview = preview
  if (typeof instance.setData === 'function') {
    instance.setData({
      __lifecycleSummary: summary,
      __lifecyclePreview: preview,
    })
  }
}

export function recordLifecycle(
  instance: { data?: LifecycleData, setData?: (data: LifecycleData) => void },
  hook: string,
  args: unknown,
  meta?: Pick<LifecycleEntry, 'source' | 'componentKind'>,
): LifecycleEntry {
  const data = ensureLifecycleData(instance)
  const order = nextOrder(data)
  const snapshotState = updateState(data, hook)
  const entry: LifecycleEntry = {
    hook,
    order,
    args: safeClone(args),
    snapshot: safeClone(snapshotState) as Record<string, unknown>,
    skipped: false,
    ...meta,
  }
  data.__lifecycleLogs?.push(entry)
  data.__lifecycleSeen![hook] = (data.__lifecycleSeen?.[hook] ?? 0) + 1
  if (typeof instance.setData === 'function') {
    instance.setData({
      __lifecycleLogs: data.__lifecycleLogs,
      __lifecycleOrder: data.__lifecycleOrder,
      __lifecycleSeen: data.__lifecycleSeen,
      __lifecycleState: data.__lifecycleState,
    })
  }
  updateSummary(instance)
  return entry
}

export function finalizeLifecycleLogs(
  instance: { data?: LifecycleData, setData?: (data: LifecycleData) => void },
  hooks: readonly string[],
  meta?: Pick<LifecycleEntry, 'source' | 'componentKind'>,
) {
  const data = ensureLifecycleData(instance)
  for (const hook of hooks) {
    if (data.__lifecycleSeen?.[hook]) {
      continue
    }
    const order = nextOrder(data)
    const snapshotState = updateState(data, hook)
    const entry: LifecycleEntry = {
      hook,
      order,
      args: null,
      snapshot: safeClone(snapshotState) as Record<string, unknown>,
      skipped: true,
      ...meta,
    }
    data.__lifecycleLogs?.push(entry)
    data.__lifecycleSeen![hook] = 0
  }
  if (typeof instance.setData === 'function') {
    instance.setData({
      __lifecycleLogs: data.__lifecycleLogs,
      __lifecycleOrder: data.__lifecycleOrder,
      __lifecycleSeen: data.__lifecycleSeen,
      __lifecycleState: data.__lifecycleState,
    })
  }
  updateSummary(instance)
  return data.__lifecycleLogs ?? []
}
