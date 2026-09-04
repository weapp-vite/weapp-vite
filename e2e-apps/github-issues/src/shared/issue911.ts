import { useRouter } from 'wevu/router'

const ISSUE_911_ROUTE = 'pages/issue-911/index'
const ISSUE_911_TRACE_STORAGE_KEY = '__weapp_vite_issue_911_trace__'
const trace: string[] = []
let guardInstalled = false
let traceMode: string | undefined

type Issue911Mode = 'default' | 'redirect' | 'redirect-target' | 'abort' | 'never' | 'reject' | 'late'

function resolveIssue911Mode(to: { query?: Record<string, unknown> }): Issue911Mode {
  const mode = String(to.query?.mode ?? 'default')
  return mode === 'redirect' || mode === 'redirect-target' || mode === 'abort' || mode === 'never' || mode === 'reject' || mode === 'late'
    ? mode
    : 'default'
}

function recordIssue911Trace(mode: Issue911Mode, entry: string) {
  trace.push(entry)
  if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
    wx.setStorageSync(ISSUE_911_TRACE_STORAGE_KEY, {
      mode,
      trace: [...trace],
    })
  }
}

export function ensureIssue911Guard() {
  if (guardInstalled) {
    return
  }

  guardInstalled = true
  useRouter().beforeEach(async (to) => {
    if (to.path.replace(/^\/+/, '') !== ISSUE_911_ROUTE) {
      return
    }

    const mode = resolveIssue911Mode(to)
    if (traceMode !== mode && !(traceMode === 'redirect' && mode === 'redirect-target')) {
      trace.length = 0
    }
    traceMode = mode
    recordIssue911Trace(mode, 'beforeEach:start')
    if (mode === 'never') {
      await new Promise<void>(() => {})
    }
    await new Promise<void>(resolve => setTimeout(resolve, mode === 'late' ? 10_500 : 100))
    recordIssue911Trace(mode, 'beforeEach:done')
    if (mode === 'reject') {
      throw new Error('issue-911 guard rejected')
    }
    if (mode === 'abort') {
      return false
    }
    if (mode === 'redirect') {
      recordIssue911Trace(mode, 'redirect')
      return `${ISSUE_911_ROUTE}?mode=redirect-target`
    }
  })
}

export function recordIssue911Mounted() {
  trace.push('mounted')
  if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
    wx.setStorageSync(ISSUE_911_TRACE_STORAGE_KEY, {
      mode: traceMode ?? 'default',
      trace: [...trace],
    })
  }
}

export function recordIssue911Unmounted() {
  if (traceMode !== 'late') {
    return
  }
  trace.push('unmounted')
  if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
    wx.setStorageSync(ISSUE_911_TRACE_STORAGE_KEY, {
      mode: traceMode,
      trace: [...trace],
    })
  }
}

export function readIssue911Trace() {
  return [...trace]
}
