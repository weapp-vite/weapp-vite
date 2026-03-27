<script setup lang="ts">
import type { DashboardRuntimeEventKind, DashboardRuntimeEventLevel } from '../features/dashboard/types'
import { computed, ref } from 'vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { pillButtonStyles } from '../features/dashboard/utils/styles'

const { activityItems, diagnostics, eventSummary, runtimeEvents } = useDashboardWorkspace()

type EventKindFilter = 'all' | DashboardRuntimeEventKind
type EventLevelFilter = 'all' | DashboardRuntimeEventLevel

const eventKindFilter = ref<EventKindFilter>('all')
const eventLevelFilter = ref<EventLevelFilter>('all')
const searchQuery = ref('')

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

function formatEventKind(kind: DashboardRuntimeEventKind) {
  switch (kind) {
    case 'command':
      return '命令'
    case 'build':
      return '构建'
    case 'diagnostic':
      return '诊断'
    case 'hmr':
      return 'HMR'
    case 'system':
      return '系统'
    default:
      return kind
  }
}

function formatEventLevel(level: DashboardRuntimeEventLevel) {
  switch (level) {
    case 'info':
      return '信息'
    case 'success':
      return '成功'
    case 'warning':
      return '警告'
    case 'error':
      return '错误'
    default:
      return level
  }
}

const filteredRuntimeEvents = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()

  return runtimeEvents.value.filter((event) => {
    if (eventKindFilter.value !== 'all' && event.kind !== eventKindFilter.value) {
      return false
    }

    if (eventLevelFilter.value !== 'all' && event.level !== eventLevelFilter.value) {
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

const filteredEventSummary = computed(() => [
  { label: '筛选后事件', value: String(filteredRuntimeEvents.value.length) },
  { label: '当前类型', value: eventKindFilter.value === 'all' ? '全部' : formatEventKind(eventKindFilter.value) },
  { label: '当前等级', value: eventLevelFilter.value === 'all' ? '全部' : formatEventLevel(eventLevelFilter.value) },
  { label: '搜索关键字', value: searchQuery.value.trim() || '未设置' },
])
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
          <div
            v-for="item in [...eventSummary, ...filteredEventSummary]"
            :key="item.label"
            class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3"
          >
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
              {{ item.label }}
            </p>
            <p class="mt-1 text-lg font-semibold">
              {{ item.value }}
            </p>
          </div>
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
              <span class="rounded-full bg-[color:var(--dashboard-accent-soft)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--dashboard-accent)]">
                {{ item.status }}
              </span>
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
          <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
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
                    类型过滤
                  </p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <button
                      v-for="option in eventKindOptions"
                      :key="option.value"
                      :class="pillButtonStyles({ kind: 'theme', active: eventKindFilter === option.value })"
                      @click="eventKindFilter = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>

                <div>
                  <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
                    等级过滤
                  </p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <button
                      v-for="option in eventLevelOptions"
                      :key="option.value"
                      :class="pillButtonStyles({ kind: 'theme', active: eventLevelFilter === option.value })"
                      @click="eventLevelFilter = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
              class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3"
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
                    {{ formatEventKind(event.kind) }} · {{ event.source ?? 'dashboard' }} · {{ event.timestamp }}
                  </p>
                  <p v-if="event.tags?.length" class="mt-2 flex flex-wrap gap-1.5">
                    <span
                      v-for="tag in event.tags"
                      :key="tag"
                      class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-[color:var(--dashboard-text-soft)]"
                    >
                      {{ tag }}
                    </span>
                  </p>
                </div>
                <span class="rounded-full bg-[color:var(--dashboard-accent-soft)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--dashboard-accent)]">
                  {{ formatEventLevel(event.level) }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </AppSurfaceCard>
    </div>
  </div>
</template>
