<script setup lang="ts">
import type { ActivityEventSortMode, DashboardKeyOption, DashboardLabelValueItem, DashboardValueOption } from '../features/dashboard/types'
import { computed, ref, watch } from 'vue'
import ActivityEventSortBar from '../features/dashboard/components/ActivityEventSortBar.vue'
import ActivityInsightPanel from '../features/dashboard/components/ActivityInsightPanel.vue'
import AppEmptyState from '../features/dashboard/components/AppEmptyState.vue'
import AppEventFilterPanel from '../features/dashboard/components/AppEventFilterPanel.vue'
import AppRuntimeEventListItem from '../features/dashboard/components/AppRuntimeEventListItem.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { formatDuration, formatRuntimeEventKind, formatRuntimeEventLevel } from '../features/dashboard/utils/format'
import { formatRuntimeSourceSummary, summarizeRuntimeEventsBySource } from '../features/dashboard/utils/runtimeEvents'

const { diagnostics, eventSummary, runtimeEvents } = useDashboardWorkspace()

type EventKindFilter = 'all' | typeof runtimeEvents.value[number]['kind']
type EventLevelFilter = 'all' | typeof runtimeEvents.value[number]['level']
type FilterPresetKey = 'all' | 'issues' | 'commands' | 'hmr'
type FilterPreset = DashboardKeyOption<FilterPresetKey> & {
  description: string
  apply: () => void
}

const eventKindFilter = ref<EventKindFilter>('all')
const eventLevelFilter = ref<EventLevelFilter>('all')
const eventSourceFilter = ref('all')
const eventSortMode = ref<ActivityEventSortMode>('time')
const searchQuery = ref('')
const selectedEventId = ref<string | null>(null)

const eventLevelRank = {
  error: 4,
  warning: 3,
  success: 2,
  info: 1,
} satisfies Record<typeof runtimeEvents.value[number]['level'], number>

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

  return runtimeEvents.value
    .filter((event) => {
      if (eventKindFilter.value !== 'all' && event.kind !== eventKindFilter.value) {
        return false
      }

      if (eventLevelFilter.value !== 'all' && event.level !== eventLevelFilter.value) {
        return false
      }

      if (eventSourceFilter.value !== 'all' && (event.source ?? 'dashboard') !== eventSourceFilter.value) {
        return false
      }

      if (!keyword) {
        return true
      }

      return [
        event.title,
        event.detail,
        event.kind,
        event.level,
        event.source ?? '',
        ...(event.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
    .sort((a, b) => {
      if (eventSortMode.value === 'duration') {
        return (b.durationMs ?? -1) - (a.durationMs ?? -1) || Date.parse(b.timestamp) - Date.parse(a.timestamp)
      }
      if (eventSortMode.value === 'severity') {
        return eventLevelRank[b.level] - eventLevelRank[a.level] || Date.parse(b.timestamp) - Date.parse(a.timestamp)
      }
      if (eventSortMode.value === 'source') {
        return (a.source ?? 'dashboard').localeCompare(b.source ?? 'dashboard') || Date.parse(b.timestamp) - Date.parse(a.timestamp)
      }
      return Date.parse(b.timestamp) - Date.parse(a.timestamp)
    })
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
</script>

<template>
  <div class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
    <AppSurfaceCard
      eyebrow="Event Feed"
      title="事件控制台"
      icon-name="hero-commands"
      content-class="min-h-0 overflow-hidden"
    >
      <div class="grid h-full min-h-0 grid-rows-[minmax(0,9rem)_auto_minmax(6rem,1fr)] gap-3 overflow-hidden">
        <AppEventFilterPanel
          class="min-h-0 overflow-y-auto"
          :search-query="searchQuery"
          :preset-description="presetDescription"
          :filter-presets="filterPresets"
          :event-kind-options="eventKindOptions"
          :event-level-options="eventLevelOptions"
          :event-source-options="eventSourceOptions"
          :event-kind-filter="eventKindFilter"
          :event-level-filter="eventLevelFilter"
          :event-source-filter="eventSourceFilter"
          @update:search-query="searchQuery = $event"
          @update:event-kind-filter="eventKindFilter = $event as EventKindFilter"
          @update:event-level-filter="eventLevelFilter = $event as EventLevelFilter"
          @update:event-source-filter="eventSourceFilter = $event"
          @apply-preset="filterPresets.find(preset => preset.key === $event)?.apply()"
        />

        <ActivityEventSortBar
          v-model="eventSortMode"
          :filtered-count="filteredRuntimeEvents.length"
          :total-count="runtimeEvents.length"
        />

        <AppEmptyState
          v-if="filteredRuntimeEvents.length === 0"
          as="p"
        >
          当前过滤条件下没有匹配事件。
        </AppEmptyState>

        <ul class="grid min-h-0 gap-2 overflow-y-auto pr-1 text-sm leading-6 text-(--dashboard-text-muted)">
          <AppRuntimeEventListItem
            v-for="event in filteredRuntimeEvents"
            :key="event.id"
            :event="event"
            :selected="selectedEvent?.id === event.id"
            @click="selectedEventId = event.id"
          />
        </ul>
      </div>
    </AppSurfaceCard>

    <ActivityInsightPanel
      :selected-event="selectedEvent"
      :event-summary="eventSummary"
      :filtered-event-summary="filteredEventSummary"
      :diagnostics="diagnostics"
      :source-breakdown="sourceBreakdown"
    />
  </div>
</template>
