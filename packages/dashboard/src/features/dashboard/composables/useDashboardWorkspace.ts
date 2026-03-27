import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type {
  AnalyzeSubpackagesResult,
  DashboardRuntimeEvent,
  WorkspaceActivityItem,
  WorkspaceCommandItem,
  WorkspaceDiagnosticItem,
  WorkspaceSignalItem,
} from '../types'
import { computed, inject, onBeforeUnmount, onMounted, provide, shallowRef } from 'vue'
import { activityFeed, diagnosticsQueue, quickCommands, sampleRuntimeEvents } from '../constants/shell'
import { formatBytes } from '../utils/format'
import { normalizeRuntimeEvents } from '../utils/runtimeEvents'

interface DashboardWorkspaceContext {
  resultRef: ShallowRef<AnalyzeSubpackagesResult | null>
  updateCount: Ref<number>
  lastUpdatedAt: Ref<string>
  statusLabel: ComputedRef<string>
  statusSummary: ComputedRef<string>
  commandItems: ComputedRef<WorkspaceCommandItem[]>
  activityItems: ComputedRef<WorkspaceActivityItem[]>
  diagnostics: ComputedRef<WorkspaceDiagnosticItem[]>
  signals: ComputedRef<WorkspaceSignalItem[]>
  runtimeEvents: Ref<DashboardRuntimeEvent[]>
  latestRuntimeEvent: ComputedRef<DashboardRuntimeEvent | null>
  eventSummary: ComputedRef<Array<{ label: string, value: string }>>
}

const dashboardWorkspaceKey: InjectionKey<DashboardWorkspaceContext> = Symbol('dashboard-workspace')

function formatCurrentTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

export function createDashboardWorkspace(): DashboardWorkspaceContext {
  const resultRef = shallowRef<AnalyzeSubpackagesResult | null>(window.__WEAPP_VITE_ANALYZE_RESULT__ ?? null)
  const runtimeEvents = shallowRef<DashboardRuntimeEvent[]>(window.__WEAPP_VITE_DASHBOARD_EVENTS__?.length
    ? normalizeRuntimeEvents(window.__WEAPP_VITE_DASHBOARD_EVENTS__)
    : normalizeRuntimeEvents(sampleRuntimeEvents))
  const updateCount = shallowRef(0)
  const lastUpdatedAt = shallowRef(resultRef.value ? formatCurrentTime() : '—')

  const summary = computed(() => {
    const result = resultRef.value

    if (!result) {
      return {
        packageCount: 0,
        moduleCount: 0,
        duplicateCount: 0,
        totalBytes: 0,
      }
    }

    const files = result.packages.flatMap(pkg => pkg.files)

    return {
      packageCount: result.packages.length,
      moduleCount: result.modules.length,
      duplicateCount: result.modules.filter(mod => mod.packages.length > 1).length,
      totalBytes: files.reduce((sum, file) => sum + (file.size ?? 0), 0),
    }
  })

  const statusLabel = computed(() => resultRef.value ? 'payload ready' : 'awaiting payload')
  const statusSummary = computed(() =>
    resultRef.value
      ? `${summary.value.packageCount} 个包 · ${summary.value.moduleCount} 个模块`
      : '尚未接收到 CLI analyze 数据',
  )
  const latestRuntimeEvent = computed(() => runtimeEvents.value[0] ?? null)

  const eventSummary = computed(() => {
    const errorCount = runtimeEvents.value.filter(event => event.level === 'error').length
    const warningCount = runtimeEvents.value.filter(event => event.level === 'warning').length
    const commandCount = runtimeEvents.value.filter(event => event.kind === 'command').length

    return [
      { label: '总事件数', value: String(runtimeEvents.value.length) },
      { label: '命令事件', value: String(commandCount) },
      { label: '警告事件', value: String(warningCount) },
      { label: '错误事件', value: String(errorCount) },
    ]
  })

  const signals = computed<WorkspaceSignalItem[]>(() => [
    {
      label: '页面骨架',
      value: '4 个',
      iconName: 'metric-ready',
    },
    {
      label: '连接状态',
      value: resultRef.value ? '已接入 payload' : '等待注入',
      iconName: resultRef.value ? 'status-live' : 'metric-health',
    },
    {
      label: '数据同步',
      value: `${updateCount.value} 次`,
      iconName: 'metric-latency',
    },
    {
      label: '产物体积',
      value: resultRef.value ? formatBytes(summary.value.totalBytes) : '未载入',
      iconName: 'metric-quality',
    },
    {
      label: '运行事件',
      value: `${runtimeEvents.value.length} 条`,
      iconName: latestRuntimeEvent.value?.level === 'error' ? 'metric-health' : 'metric-time',
    },
  ])

  const commandItems = computed<WorkspaceCommandItem[]>(() => {
    if (!resultRef.value) {
      return quickCommands
    }

    return [
      {
        label: '重新分析当前工程',
        command: 'weapp-vite analyze',
        note: `最近同步于 ${lastUpdatedAt.value}，当前可读取 ${summary.value.packageCount} 个包。`,
      },
      {
        label: '进入构建联调',
        command: 'weapp-vite build --ui',
        note: `当前产物总体积 ${formatBytes(summary.value.totalBytes)}，适合继续核对 chunk 结构。`,
      },
      {
        label: '观察开发态更新',
        command: 'weapp-vite dev --ui',
        note: `已记录 ${updateCount.value} 次 payload 同步，后续可继续接入更细粒度事件。`,
      },
    ]
  })

  const activityItems = computed<WorkspaceActivityItem[]>(() => {
    const items = [...activityFeed]

    for (const event of runtimeEvents.value.slice(0, 4)) {
      items.unshift({
        time: event.timestamp,
        title: event.title,
        summary: event.detail,
        tone: event.level === 'error' || event.level === 'warning' ? 'default' : 'live',
      })
    }

    if (resultRef.value) {
      items.unshift({
        time: lastUpdatedAt.value,
        title: 'workspace payload received',
        summary: `已收到一份真实 analyze 结果，包含 ${summary.value.packageCount} 个包和 ${summary.value.moduleCount} 个模块。`,
        tone: 'live',
      })
    }

    return items
  })

  const diagnostics = computed<WorkspaceDiagnosticItem[]>(() => {
    const items = [...diagnosticsQueue]
    const latestEvent = latestRuntimeEvent.value

    if (latestEvent) {
      items.unshift({
        label: '最新运行事件',
        detail: `${latestEvent.title} · ${latestEvent.detail}`,
        status: latestEvent.level,
      })
    }

    if (!resultRef.value) {
      return [
        {
          label: 'CLI 注入链路',
          detail: '尚未接收到 analyze payload，当前页面以空态方式工作。',
          status: '待接入',
        },
        ...items,
      ]
    }

    return [
      {
        label: '实时分析状态',
        detail: `已接入 payload，当前记录 ${summary.value.duplicateCount} 个跨包复用模块。`,
        status: '在线',
      },
      {
        label: '产物规模',
        detail: `总产物体积 ${formatBytes(summary.value.totalBytes)}，可继续进入分析页查看 treemap 与最大文件。`,
        status: '可分析',
      },
      ...items,
    ]
  })

  const pushRuntimeEvents = (payload: DashboardRuntimeEvent[] | null | undefined) => {
    const normalizedPayload = normalizeRuntimeEvents(payload)

    if (normalizedPayload.length === 0) {
      return
    }

    const nextEvents = [...normalizedPayload, ...runtimeEvents.value]
    const deduped = new Map<string, DashboardRuntimeEvent>()

    for (const event of nextEvents) {
      deduped.set(event.id, event)
    }

    runtimeEvents.value = [...deduped.values()].slice(0, 24)
    window.__WEAPP_VITE_DASHBOARD_EVENTS__ = [...runtimeEvents.value]
  }

  const syncFromWindow = () => {
    if (!window.__WEAPP_VITE_ANALYZE_RESULT__) {
      return
    }

    resultRef.value = window.__WEAPP_VITE_ANALYZE_RESULT__
    updateCount.value += 1
    lastUpdatedAt.value = formatCurrentTime()
  }

  const handleRuntimeEvent = (event: Event) => {
    const payload = event instanceof CustomEvent
      ? event.detail
      : null
    const events = Array.isArray(payload) ? payload : payload ? [payload] : null

    pushRuntimeEvents(events)
  }

  onMounted(() => {
    window.addEventListener('weapp-analyze:update', syncFromWindow)
    window.addEventListener('weapp-dashboard:event', handleRuntimeEvent)
    syncFromWindow()
    pushRuntimeEvents(window.__WEAPP_VITE_DASHBOARD_EVENTS__)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('weapp-analyze:update', syncFromWindow)
    window.removeEventListener('weapp-dashboard:event', handleRuntimeEvent)
  })

  return {
    resultRef,
    updateCount,
    lastUpdatedAt,
    statusLabel,
    statusSummary,
    commandItems,
    activityItems,
    diagnostics,
    signals,
    runtimeEvents,
    latestRuntimeEvent,
    eventSummary,
  }
}

export function provideDashboardWorkspace(context: DashboardWorkspaceContext) {
  provide(dashboardWorkspaceKey, context)
}

export function useDashboardWorkspace() {
  const context = inject(dashboardWorkspaceKey, null)

  if (!context) {
    throw new Error('[dashboard] workspace context is not available')
  }

  return context
}
