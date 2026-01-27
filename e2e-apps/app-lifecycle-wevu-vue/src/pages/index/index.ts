import type { AppLifecycleData, AppLifecycleEntry } from '../../shared/lifecycle'
import { APP_HOOKS } from '../../shared/lifecycle'

interface LifecycleSummary {
  total: number
  seen: number
  skipped: number
  entries: number
  lastHook: string
}

interface LifecyclePageData {
  message: string
  __e2eSummary: LifecycleSummary
  __e2ePreview: AppLifecycleEntry[]
}

interface LifecyclePageInstance {
  setData: (data: Partial<LifecyclePageData>) => void
}

function buildSummary(appData: AppLifecycleData = {}): LifecycleSummary {
  const seenMap = appData.__lifecycleSeen ?? {}
  const seen = APP_HOOKS.reduce((count, hook) => count + (seenMap[hook] ? 1 : 0), 0)
  const entries = appData.__lifecycleLogs?.length ?? 0
  const lastHook = typeof appData.__lifecycleState?.lastHook === 'string' ? appData.__lifecycleState.lastHook : ''
  return {
    total: APP_HOOKS.length,
    seen,
    skipped: Math.max(0, APP_HOOKS.length - seen),
    entries,
    lastHook,
  }
}

function refreshE2eState(page: LifecyclePageInstance) {
  const app = getApp<{ globalData?: AppLifecycleData }>()
  const appData = app?.globalData ?? {}
  const summary = buildSummary(appData)
  const preview = appData.__lifecycleLogs?.slice(-6) ?? []
  page.setData({
    __e2eSummary: summary,
    __e2ePreview: preview,
  })
}

Page({
  data: {
    message: 'App lifecycle wevu',
    __e2eSummary: {
      total: APP_HOOKS.length,
      seen: 0,
      skipped: APP_HOOKS.length,
      entries: 0,
      lastHook: '',
    },
    __e2ePreview: [] as AppLifecycleEntry[],
  },
  onReady() {
    refreshE2eState(this)
  },
  onShow() {
    refreshE2eState(this)
  },
})
