export const APP_HOOKS = [
  'onLaunch',
  'onShow',
  'onHide',
  'onError',
  'onPageNotFound',
  'onUnhandledRejection',
  'onThemeChange',
]

export interface AppLifecycleEntry {
  hook: string
  order: number
  args: unknown
  snapshot: Record<string, unknown>
  skipped?: boolean
  source?: string
}

export interface AppLifecycleData {
  __lifecycleLogs?: AppLifecycleEntry[]
  __lifecycleOrder?: number
  __lifecycleSeen?: Record<string, number>
  __lifecycleState?: Record<string, unknown>
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

function ensureAppData(app: { globalData: AppLifecycleData }) {
  const data = app.globalData ?? (app.globalData = {})
  data.__lifecycleLogs ??= []
  data.__lifecycleOrder ??= 0
  data.__lifecycleSeen ??= {}
  data.__lifecycleState ??= { tick: 0 }
  return data
}

function nextOrder(data: AppLifecycleData) {
  const current = typeof data.__lifecycleOrder === 'number' ? data.__lifecycleOrder : 0
  const next = current + 1
  data.__lifecycleOrder = next
  return next
}

function updateState(data: AppLifecycleData, hook: string) {
  const state = (data.__lifecycleState ?? {}) as Record<string, unknown>
  const tick = typeof state.tick === 'number' ? (state.tick as number) + 1 : 1
  const nextState = {
    ...state,
    lastHook: hook,
    tick,
  }
  data.__lifecycleState = nextState
  return nextState
}

export function recordAppLifecycle(
  app: { globalData: AppLifecycleData },
  hook: string,
  args: unknown,
  meta?: Pick<AppLifecycleEntry, 'source'>,
): AppLifecycleEntry {
  const data = ensureAppData(app)
  const order = nextOrder(data)
  const snapshotState = updateState(data, hook)
  const entry: AppLifecycleEntry = {
    hook,
    order,
    args: safeClone(args),
    snapshot: safeClone(snapshotState) as Record<string, unknown>,
    skipped: false,
    ...meta,
  }
  data.__lifecycleLogs?.push(entry)
  data.__lifecycleSeen![hook] = (data.__lifecycleSeen?.[hook] ?? 0) + 1
  return entry
}

export function finalizeAppLifecycle(
  app: { globalData: AppLifecycleData },
  hooks: readonly string[],
  meta?: Pick<AppLifecycleEntry, 'source'>,
) {
  const data = ensureAppData(app)
  for (const hook of hooks) {
    if (data.__lifecycleSeen?.[hook]) {
      continue
    }
    const order = nextOrder(data)
    const snapshotState = updateState(data, hook)
    const entry: AppLifecycleEntry = {
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
  return data.__lifecycleLogs ?? []
}
