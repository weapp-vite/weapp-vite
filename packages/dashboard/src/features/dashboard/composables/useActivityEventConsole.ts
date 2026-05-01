import type { Ref } from 'vue'
import type {
  ActivityEventSortMode,
  DashboardKeyOption,
  DashboardLabelValueItem,
  DashboardRuntimeEvent,
  DashboardValueOption,
} from '../types'
import { computed, ref, watch } from 'vue'
import { formatDuration, formatRuntimeEventKind, formatRuntimeEventLevel } from '../utils/format'
import { formatRuntimeSourceSummary, summarizeRuntimeEventsBySource } from '../utils/runtimeEvents'
import { createRuntimeIncidentDigest } from '../utils/runtimeIncidentDigest'

export type EventKindFilter = 'all' | DashboardRuntimeEvent['kind']
export type EventLevelFilter = 'all' | DashboardRuntimeEvent['level']
export type FilterPresetKey = 'all' | 'issues' | 'commands' | 'hmr'
export type FilterPreset = DashboardKeyOption<FilterPresetKey> & {
  description: string
  apply: () => void
}

const eventLevelRank = {
  error: 4,
  warning: 3,
  success: 2,
  info: 1,
} satisfies Record<DashboardRuntimeEvent['level'], number>

const eventKindOptions: DashboardValueOption<EventKindFilter>[] = [
  { value: 'all', label: '全部类型' },
  { value: 'command', label: '命令' },
  { value: 'build', label: '构建' },
  { value: 'diagnostic', label: '诊断' },
  { value: 'hmr', label: 'HMR' },
  { value: 'system', label: '系统' },
]

const eventLevelOptions: DashboardValueOption<EventLevelFilter>[] = [
  { value: 'all', label: '全部等级' },
  { value: 'info', label: '信息' },
  { value: 'success', label: '成功' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
]

function eventMatchesKeyword(event: DashboardRuntimeEvent, keyword: string) {
  return [
    event.title,
    event.detail,
    event.kind,
    event.level,
    event.source ?? '',
    ...(event.tags ?? []),
  ].join(' ').toLowerCase().includes(keyword)
}

function sortRuntimeEvents(
  events: DashboardRuntimeEvent[],
  mode: ActivityEventSortMode,
) {
  return [...events].sort((a, b) => {
    if (mode === 'duration') {
      return (b.durationMs ?? -1) - (a.durationMs ?? -1) || Date.parse(b.timestamp) - Date.parse(a.timestamp)
    }
    if (mode === 'severity') {
      return eventLevelRank[b.level] - eventLevelRank[a.level] || Date.parse(b.timestamp) - Date.parse(a.timestamp)
    }
    if (mode === 'source') {
      return (a.source ?? 'dashboard').localeCompare(b.source ?? 'dashboard') || Date.parse(b.timestamp) - Date.parse(a.timestamp)
    }
    return Date.parse(b.timestamp) - Date.parse(a.timestamp)
  })
}

export function useActivityEventConsole(runtimeEvents: Ref<DashboardRuntimeEvent[]>) {
  const eventKindFilter = ref<EventKindFilter>('all')
  const eventLevelFilter = ref<EventLevelFilter>('all')
  const eventSourceFilter = ref('all')
  const eventSortMode = ref<ActivityEventSortMode>('time')
  const searchQuery = ref('')
  const selectedEventId = ref<string | null>(null)

  const filterPresets: FilterPreset[] = [
    {
      key: 'all',
      label: '查看全部',
      description: '回到完整事件流',
      apply() {
        eventKindFilter.value = 'all'
        eventLevelFilter.value = 'all'
        eventSourceFilter.value = 'all'
        searchQuery.value = ''
      },
    },
    {
      key: 'issues',
      label: '异常优先',
      description: '只看警告和错误',
      apply() {
        eventKindFilter.value = 'all'
        eventLevelFilter.value = 'warning'
        eventSourceFilter.value = 'all'
        searchQuery.value = ''
      },
    },
    {
      key: 'commands',
      label: '命令流',
      description: '聚焦命令执行事件',
      apply() {
        eventKindFilter.value = 'command'
        eventLevelFilter.value = 'all'
        eventSourceFilter.value = 'all'
        searchQuery.value = ''
      },
    },
    {
      key: 'hmr',
      label: 'HMR',
      description: '观察热更新相关事件',
      apply() {
        eventKindFilter.value = 'hmr'
        eventLevelFilter.value = 'all'
        eventSourceFilter.value = 'all'
        searchQuery.value = ''
      },
    },
  ]

  const eventSourceOptions = computed<DashboardValueOption[]>(() => {
    const sourceSet = new Set(
      runtimeEvents.value
        .map(event => event.source ?? 'dashboard')
        .filter(Boolean),
    )

    return [
      { value: 'all', label: '全部来源' },
      ...[...sourceSet]
        .sort((left, right) => left.localeCompare(right, 'zh-CN'))
        .map(source => ({ value: source, label: source })),
    ]
  })

  const filteredRuntimeEvents = computed(() => {
    const keyword = searchQuery.value.trim().toLowerCase()
    const filtered = runtimeEvents.value.filter((event) => {
      if (eventKindFilter.value !== 'all' && event.kind !== eventKindFilter.value) {
        return false
      }
      if (eventLevelFilter.value !== 'all' && event.level !== eventLevelFilter.value) {
        return false
      }
      if (eventSourceFilter.value !== 'all' && (event.source ?? 'dashboard') !== eventSourceFilter.value) {
        return false
      }
      return !keyword || eventMatchesKeyword(event, keyword)
    })
    return sortRuntimeEvents(filtered, eventSortMode.value)
  })

  const filteredEventSummary = computed<DashboardLabelValueItem[]>(() => {
    const timedEvents = filteredRuntimeEvents.value.filter(event => typeof event.durationMs === 'number')
    const averageDuration = timedEvents.length > 0
      ? Math.round(timedEvents.reduce((sum, event) => sum + (event.durationMs ?? 0), 0) / timedEvents.length)
      : undefined

    return [
      { label: '筛选后事件', value: String(filteredRuntimeEvents.value.length) },
      { label: '当前类型', value: eventKindFilter.value === 'all' ? '全部' : formatRuntimeEventKind(eventKindFilter.value) },
      { label: '当前等级', value: eventLevelFilter.value === 'all' ? '全部' : formatRuntimeEventLevel(eventLevelFilter.value) },
      { label: '当前来源', value: eventSourceFilter.value === 'all' ? '全部' : eventSourceFilter.value },
      { label: '搜索关键字', value: searchQuery.value.trim() || '未设置' },
      { label: '筛选平均耗时', value: formatDuration(averageDuration) },
    ]
  })

  const sourceBreakdown = computed(() => {
    return formatRuntimeSourceSummary(summarizeRuntimeEventsBySource(filteredRuntimeEvents.value))
  })

  const incidentDigest = computed(() => createRuntimeIncidentDigest(filteredRuntimeEvents.value))

  const selectedEvent = computed(() =>
    filteredRuntimeEvents.value.find(event => event.id === selectedEventId.value)
    ?? filteredRuntimeEvents.value[0]
    ?? null,
  )

  const presetDescription = computed(() => {
    const activePreset = filterPresets.find((preset) => {
      if (preset.key === 'issues') {
        return eventKindFilter.value === 'all' && eventLevelFilter.value === 'warning' && eventSourceFilter.value === 'all' && searchQuery.value === ''
      }
      if (preset.key === 'commands') {
        return eventKindFilter.value === 'command' && eventLevelFilter.value === 'all' && eventSourceFilter.value === 'all' && searchQuery.value === ''
      }
      if (preset.key === 'hmr') {
        return eventKindFilter.value === 'hmr' && eventLevelFilter.value === 'all' && eventSourceFilter.value === 'all' && searchQuery.value === ''
      }
      return eventKindFilter.value === 'all' && eventLevelFilter.value === 'all' && eventSourceFilter.value === 'all' && searchQuery.value === ''
    })
    return activePreset?.description ?? ''
  })

  watch(filteredRuntimeEvents, (events) => {
    if (events.length === 0) {
      selectedEventId.value = null
      return
    }

    if (!events.some(event => event.id === selectedEventId.value)) {
      selectedEventId.value = events[0]?.id ?? null
    }
  }, { immediate: true })

  return {
    eventKindFilter,
    eventKindOptions,
    eventLevelFilter,
    eventLevelOptions,
    eventSortMode,
    eventSourceFilter,
    eventSourceOptions,
    filteredEventSummary,
    filteredRuntimeEvents,
    filterPresets,
    incidentDigest,
    presetDescription,
    searchQuery,
    selectedEvent,
    selectedEventId,
    sourceBreakdown,
  }
}
