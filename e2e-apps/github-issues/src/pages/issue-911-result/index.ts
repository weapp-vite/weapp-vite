import { resetIssue911Trace } from '../../shared/issue911'

const TRACE_KEY = '__weapp_vite_issue_911_trace__'

Page({
  data: {
    mode: 'none',
    trace: [] as string[],
    mountedCount: 0,
  },
  onLoad() {
    this.refreshTrace()
  },
  refreshTrace() {
    const snapshot: unknown = wx.getStorageSync(TRACE_KEY)
    const record = snapshot && typeof snapshot === 'object'
      ? snapshot as { mode?: unknown, trace?: unknown }
      : undefined
    const trace = Array.isArray(record?.trace) ? record.trace.map(String) : []
    this.setData({
      mode: typeof record?.mode === 'string' ? record.mode : 'none',
      trace,
      mountedCount: trace.filter(entry => entry === 'mounted').length,
    })
  },
  resetTrace() {
    resetIssue911Trace()
    this.refreshTrace()
  },
})
