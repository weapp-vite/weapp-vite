<script setup lang="ts">
import type { ActivityEventSortMode, DashboardRuntimeEvent } from '../types'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatDuration, formatRuntimeEventKind, formatRuntimeEventLevel } from '../utils/format'

const props = defineProps<{
  events: DashboardRuntimeEvent[]
  filteredCount: number
  totalCount: number
}>()

const sortMode = defineModel<ActivityEventSortMode>({ required: true })

const actionStatus = ref('')
let actionStatusTimer: ReturnType<typeof setTimeout> | null = null

function escapeMarkdownCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

const reportText = computed(() => [
  '# dashboard 事件流',
  '',
  `事件数量：${props.events.length}`,
  '',
  '| 时间 | 等级 | 类型 | 来源 | 标题 | 耗时 | 标签 |',
  '| --- | --- | --- | --- | --- | ---: | --- |',
  ...props.events.map(event => [
    event.timestamp,
    formatRuntimeEventLevel(event.level),
    formatRuntimeEventKind(event.kind),
    event.source ?? 'dashboard',
    event.title,
    formatDuration(event.durationMs),
    event.tags?.join(', ') || '-',
  ].map(escapeMarkdownCell).join(' | ')).map(row => `| ${row} |`),
  '',
].join('\n'))

function setActionStatus(status: string) {
  actionStatus.value = status
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer)
  }
  actionStatusTimer = setTimeout(() => {
    actionStatus.value = ''
    actionStatusTimer = null
  }, 1800)
}

async function copyEventReport() {
  try {
    await copyText(reportText.value)
    setActionStatus('已复制')
  }
  catch {
    setActionStatus('复制失败')
  }
}

function exportEventJson() {
  const blob = new Blob([`${JSON.stringify(props.events, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-dashboard-events.json'
  anchor.click()
  URL.revokeObjectURL(url)
  setActionStatus('已导出')
}

onBeforeUnmount(() => {
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer)
  }
})
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2">
    <p class="text-xs text-(--dashboard-text-soft)">
      匹配 {{ filteredCount }} / {{ totalCount }} 条事件
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="actionStatus" class="text-xs font-medium text-(--dashboard-accent)">
        {{ actionStatus }}
      </span>
      <button
        type="button"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
        :disabled="events.length === 0"
        @click="copyEventReport"
      >
        复制事件
      </button>
      <button
        type="button"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
        :disabled="events.length === 0"
        @click="exportEventJson"
      >
        导出 JSON
      </button>
      <select
        v-model="sortMode"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
      >
        <option value="time">
          按时间
        </option>
        <option value="duration">
          按耗时
        </option>
        <option value="severity">
          按等级
        </option>
        <option value="source">
          按来源
        </option>
      </select>
    </div>
  </div>
</template>
