<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppEmptyState from '../features/dashboard/components/AppEmptyState.vue'
import AppEventFilterPanel from '../features/dashboard/components/AppEventFilterPanel.vue'
import AppInsetPanel from '../features/dashboard/components/AppInsetPanel.vue'
import AppKeyValueList from '../features/dashboard/components/AppKeyValueList.vue'
import AppRuntimeBadge from '../features/dashboard/components/AppRuntimeBadge.vue'
import AppRuntimeEventListItem from '../features/dashboard/components/AppRuntimeEventListItem.vue'
import AppRuntimeFocusCard from '../features/dashboard/components/AppRuntimeFocusCard.vue'
import AppRuntimeSourceCard from '../features/dashboard/components/AppRuntimeSourceCard.vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppStatCard from '../features/dashboard/components/AppStatCard.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import AppTagList from '../features/dashboard/components/AppTagList.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { formatDuration, formatRuntimeEventKind, formatRuntimeEventLevel, formatRuntimeEventSource } from '../features/dashboard/utils/format'
import { summarizeRuntimeEventsBySource } from '../features/dashboard/utils/runtimeEvents'

const { activityItems, diagnostics, eventSummary, runtimeEvents } = useDashboardWorkspace()

type EventKindFilter = 'all' | typeof runtimeEvents.value[number]['kind']
type EventLevelFilter = 'all' | typeof runtimeEvents.value[number]['level']

const eventKindFilter = ref<EventKindFilter>('all')
const eventLevelFilter = ref<EventLevelFilter>('all')
const eventSourceFilter = ref('all')
const searchQuery = ref('')
const selectedEventId = ref<string | null>(null)

const eventKindOptions: Array<{ value: EventKindFilter, label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'command', label: '命令' },
  { value: 'build', label: '构建' },
  { value: 'diagnostic', label: '诊断' },
  { value: 'hmr', label: 'HMR' },
  { value: 'system', label: '系统' },
]

const eventLevelOptions: Array<{ value: EventLevelFilter, label: string }> = [
  { value: 'all', label: '全部等级' },
  { value: 'info', label: '信息' },
  { value: 'success', label: '成功' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
]

const filterPresets = [
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

const eventSourceOptions = computed(() => {
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

  return runtimeEvents.value.filter((event) => {
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
})

const filteredEventSummary = computed(() => {
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
  return summarizeRuntimeEventsBySource(filteredRuntimeEvents.value).map(source => ({
    ...source,
    averageDuration: formatDuration(source.averageDurationMs),
  }))
})

const selectedEvent = computed(() =>
  filteredRuntimeEvents.value.find(event => event.id === selectedEventId.value)
  ?? filteredRuntimeEvents.value[0]
  ?? null,
)

const presetDescription = computed(() => {
  const description = filterPresets.find(preset => preset.key === 'all')?.description ?? ''
  return `${description} 也可以直接组合下面的类型、等级和关键字筛选。`
})

const selectedEventMeta = computed(() => {
  if (!selectedEvent.value) {
    return []
  }

  return [
    { label: '事件类型', value: formatRuntimeEventKind(selectedEvent.value.kind) },
    { label: '事件等级', value: formatRuntimeEventLevel(selectedEvent.value.level) },
    { label: '事件来源', value: formatRuntimeEventSource(selectedEvent.value.source) },
    { label: '发生时间', value: selectedEvent.value.timestamp },
    { label: '持续时间', value: formatDuration(selectedEvent.value.durationMs) },
    { label: '标签数量', value: String(selectedEvent.value.tags?.length ?? 0) },
  ]
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
  <div class="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
    <AppSurfaceCard tone="strong" padding="md">
      <AppSectionHeading
        eyebrow="Timeline"
        title="活动流与增强节奏"
        description="这一页先承载假数据时间线，后续最适合接入 dev server 事件、构建阶段、HMR 推送和 CLI 诊断结果。"
      />
      <ol class="mt-5 grid gap-3">
        <li
          v-for="item in activityItems"
          :key="`${item.time}-${item.title}`"
          class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4"
        >
          <div class="flex items-start gap-3">
            <span class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]">
              <span class="h-5 w-5">
                <DashboardIcon :name="item.tone === 'live' ? 'status-live' : 'metric-time'" />
              </span>
            </span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <strong class="tracking-tight">{{ item.title }}</strong>
                <span class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
                  {{ item.time }}
                </span>
              </div>
              <p class="mt-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
                {{ item.summary }}
              </p>
            </div>
          </div>
        </li>
      </ol>
    </AppSurfaceCard>

    <div class="grid gap-3">
      <AppSurfaceCard
        eyebrow="Runtime"
        title="事件摘要"
        description="这组摘要来自共享工作区状态层。未来接 CLI 或 MCP 时，只需要持续往事件流里追加结构化事件。"
        icon-name="metric-time"
      >
        <div class="grid gap-2 sm:grid-cols-2">
          <AppStatCard
            v-for="item in [...eventSummary, ...filteredEventSummary]"
            :key="item.label"
            :label="item.label"
            :value="item.value"
          />
        </div>
      </AppSurfaceCard>

      <AppSurfaceCard
        eyebrow="Diagnostics"
        title="当前诊断队列"
        description="这里不是产品逻辑页，而是 dashboard 未来最需要的第二层能力: 把运行状态和建议动作结构化展示。"
        icon-name="metric-health"
      >
        <ul class="grid gap-2">
          <li
            v-for="item in diagnostics"
            :key="item.label"
            class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium">
                  {{ item.label }}
                </p>
                <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
                  {{ item.detail }}
                </p>
              </div>
              <AppRuntimeBadge :label="item.status" tone="info" />
            </div>
          </li>
        </ul>
      </AppSurfaceCard>

      <AppSurfaceCard
        eyebrow="Event Feed"
        title="结构化事件控制台"
        description="当前事件已经支持按类型、等级和关键字过滤。后续即便接入主包真实事件，也可以复用这套前端交互层。"
        icon-name="hero-commands"
      >
        <div class="grid gap-3">
          <AppEventFilterPanel
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

          <div
            v-if="sourceBreakdown.length > 0"
            class="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
          >
            <AppRuntimeSourceCard
              v-for="source in sourceBreakdown"
              :key="source.source"
              :source="source.source"
              :count="source.count"
              :error-count="source.errorCount"
              :latest-timestamp="source.latestTimestamp"
              :average-duration="source.averageDuration"
            />
          </div>

          <div
            v-if="selectedEvent"
            class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.78fr)]"
          >
            <AppRuntimeFocusCard
              :event="selectedEvent"
              eyebrow="selected event"
            >
              <AppTagList v-if="selectedEvent.tags?.length" class="mt-4" :tags="selectedEvent.tags" />
            </AppRuntimeFocusCard>

            <AppInsetPanel eyebrow="event metadata">
              <AppKeyValueList :items="selectedEventMeta" />
            </AppInsetPanel>
          </div>

          <AppEmptyState
            v-if="filteredRuntimeEvents.length === 0"
            as="p"
          >
            当前过滤条件下没有匹配的事件。你可以清空关键字，或者切回“全部类型 / 全部等级”。
          </AppEmptyState>

          <ul class="grid gap-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
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
    </div>
  </div>
</template>
