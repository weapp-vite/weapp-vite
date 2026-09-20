import type { AppLifecycleData, AppLifecycleEntry } from '../../shared/lifecycle'
import { getHostLifecycleInputRows } from '../../../../shared/appLifecycle'
import { APP_HOOKS } from '../../shared/lifecycle'

interface LifecycleSummary {
  total: number
  seen: number
  skipped: number
  entries: number
  lastHook: string
}

interface LifecyclePageData {
  __hostInputs: ReturnType<typeof getHostLifecycleInputRows>
  message: string
  __e2eSummary: LifecycleSummary
  __e2ePreview: AppLifecycleEntry[]
  __e2eHooks: Array<{ name: string, status: string }>
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
    __hostInputs: getHostLifecycleInputRows(),
    __e2eSummary: summary,
    __e2ePreview: preview,
    __e2eHooks: APP_HOOKS.map(name => ({
      name,
      status: appData.__lifecycleSeen?.[name] ? 'observed' : appData.__lifecycleLogs?.some(entry => entry.hook === name && entry.skipped) ? 'skipped' : 'pending',
    })),
  })
}

Page({
  data: {
    __hostInputs: [] as ReturnType<typeof getHostLifecycleInputRows>,
    message: 'App lifecycle wevu',
    __e2eSummary: {
      total: APP_HOOKS.length,
      seen: 0,
      skipped: APP_HOOKS.length,
      entries: 0,
      lastHook: '',
    },
    __e2ePreview: [] as AppLifecycleEntry[],
    __e2eHooks: [] as Array<{ name: string, status: string }>,
  },
  onReady() {
    refreshE2eState(this)
  },
  onShow() {
    refreshE2eState(this)
  },
  refreshLifecycleSummary() {
    refreshE2eState(this)
  },
})
