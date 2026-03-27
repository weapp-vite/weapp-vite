<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppDiagnosticItem from '../features/dashboard/components/AppDiagnosticItem.vue'
import AppFilterGroup from '../features/dashboard/components/AppFilterGroup.vue'
import AppInsetPanel from '../features/dashboard/components/AppInsetPanel.vue'
import AppKeyValueList from '../features/dashboard/components/AppKeyValueList.vue'
import AppRuntimeBadge from '../features/dashboard/components/AppRuntimeBadge.vue'
import AppRuntimeFocusCard from '../features/dashboard/components/AppRuntimeFocusCard.vue'
import AppRuntimeSourceCard from '../features/dashboard/components/AppRuntimeSourceCard.vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppStatCard from '../features/dashboard/components/AppStatCard.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import AppTagList from '../features/dashboard/components/AppTagList.vue'
import AppTimelineItem from '../features/dashboard/components/AppTimelineItem.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { formatDuration, formatRuntimeEventKind, formatRuntimeEventLevel, formatRuntimeEventMeta, formatRuntimeEventSource, getRuntimeEventBadgeTone } from '../features/dashboard/utils/format'
import { summarizeRuntimeEventsBySource } from '../features/dashboard/utils/runtimeEvents'
import { pillButtonStyles } from '../features/dashboard/utils/styles'

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
        <AppTimelineItem
          v-for="item in activityItems"
          :key="`${item.time}-${item.title}`"
          :title="item.title"
          :time="item.time"
          :summary="item.summary"
          :icon-name="item.tone === 'live' ? 'status-live' : 'metric-time'"
        />
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
          <AppDiagnosticItem
            v-for="item in diagnostics"
            :key="item.label"
            :label="item.label"
            :detail="item.detail"
            :status="item.status"
          />
        </ul>
      </AppSurfaceCard>

      <AppSurfaceCard
        eyebrow="Event Feed"
        title="结构化事件控制台"
        description="当前事件已经支持按类型、等级和关键字过滤。后续即便接入主包真实事件，也可以复用这套前端交互层。"
        icon-name="hero-commands"
      >
        <div class="grid gap-3">
          <AppInsetPanel>
            <div class="grid gap-3">
              <div>
                <label class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]" for="dashboard-event-search">
                  搜索事件
                </label>
                <input
                  id="dashboard-event-search"
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索标题、详情、来源或标签"
                  class="mt-2 w-full rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-2 text-sm text-[color:var(--dashboard-text)] outline-none transition focus:border-[color:var(--dashboard-border-strong)]"
                >
              </div>

              <div class="grid gap-3">
                <div>
                  <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
                    快速预设
                  </p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <button
                      v-for="preset in filterPresets"
                      :key="preset.key"
                      :class="pillButtonStyles({ kind: 'theme', active: false })"
                      @click="preset.apply()"
                    >
                      {{ preset.label }}
                    </button>
                  </div>
                  <p class="mt-2 text-xs leading-5 text-[color:var(--dashboard-text-soft)]">
                    {{ filterPresets.find(preset => preset.key === 'all')?.description }}
                    也可以直接组合下面的类型、等级和关键字筛选。
                  </p>
                </div>

                <AppFilterGroup
                  title="类型过滤"
                  :options="eventKindOptions"
                  :selected-value="eventKindFilter"
                  @select="eventKindFilter = $event as EventKindFilter"
                />

                <AppFilterGroup
                  title="等级过滤"
                  :options="eventLevelOptions"
                  :selected-value="eventLevelFilter"
                  @select="eventLevelFilter = $event as EventLevelFilter"
                />

                <AppFilterGroup
                  title="来源过滤"
                  :options="eventSourceOptions"
                  :selected-value="eventSourceFilter"
                  @select="eventSourceFilter = $event"
                />
              </div>
            </div>
          </AppInsetPanel>

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

          <p
            v-if="filteredRuntimeEvents.length === 0"
            class="rounded-[18px] border border-dashed border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-4 text-sm leading-6 text-[color:var(--dashboard-text-soft)]"
          >
            当前过滤条件下没有匹配的事件。你可以清空关键字，或者切回“全部类型 / 全部等级”。
          </p>

          <ul class="grid gap-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
            <li
              v-for="event in filteredRuntimeEvents"
              :key="event.id"
              class="rounded-[18px] border bg-[color:var(--dashboard-panel-muted)] px-4 py-3 transition"
              :class="[
                selectedEvent?.id === event.id
                  ? 'border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel)]'
                  : 'border-[color:var(--dashboard-border)]',
              ]"
              @click="selectedEventId = event.id"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium text-[color:var(--dashboard-text)]">
                    {{ event.title }}
                  </p>
                  <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
                    {{ event.detail }}
                  </p>
                  <p class="mt-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
                    {{ formatRuntimeEventMeta(event) }}
                  </p>
                  <AppTagList v-if="event.tags?.length" class="mt-2" :tags="event.tags" />
                </div>
                <AppRuntimeBadge :label="formatRuntimeEventLevel(event.level)" :tone="getRuntimeEventBadgeTone(event.level)" />
              </div>
            </li>
          </ul>
        </div>
      </AppSurfaceCard>
    </div>
  </div>
</template>
