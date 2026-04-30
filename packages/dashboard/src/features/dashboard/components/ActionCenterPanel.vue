<script setup lang="ts">
import type { AnalyzeActionCenterItem, AnalyzeActionCenterKind, AnalyzeActionCenterTone } from '../types'
import { computed, ref } from 'vue'
import { runtimeBadgeStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import DashboardIcon from './DashboardIcon.vue'

type ActionToneFilter = 'all' | AnalyzeActionCenterTone
type ActionKindFilter = 'all' | AnalyzeActionCenterKind
type ActionSortMode = 'priority' | 'severity' | 'title' | 'value'

const props = defineProps<{
  actions: AnalyzeActionCenterItem[]
  activeKey: string | null
}>()

const emit = defineEmits<{
  select: [item: AnalyzeActionCenterItem]
  copyReport: []
}>()

const actionQuery = ref('')
const actionToneFilter = ref<ActionToneFilter>('all')
const actionKindFilter = ref<ActionKindFilter>('all')
const actionSortMode = ref<ActionSortMode>('priority')

const toneRank: Record<AnalyzeActionCenterTone, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
}

function getKindLabel(kind: AnalyzeActionCenterKind) {
  if (kind === 'budget') {
    return '预算'
  }
  if (kind === 'increment') {
    return '增量'
  }
  if (kind === 'duplicate') {
    return '重复'
  }
  return '文件'
}

const toneOptions = computed(() => {
  const toneSet = new Set<AnalyzeActionCenterTone>()
  for (const item of props.actions) {
    toneSet.add(item.tone)
  }
  return [...toneSet].sort((a, b) => toneRank[b] - toneRank[a])
})

const kindOptions = computed(() => {
  const kindSet = new Set<AnalyzeActionCenterKind>()
  for (const item of props.actions) {
    kindSet.add(item.kind)
  }
  return [...kindSet].sort((a, b) => getKindLabel(a).localeCompare(getKindLabel(b)))
})

const filteredActions = computed(() => {
  const keyword = actionQuery.value.trim().toLowerCase()
  return props.actions
    .filter((item) => {
      if (actionToneFilter.value !== 'all' && item.tone !== actionToneFilter.value) {
        return false
      }
      if (actionKindFilter.value !== 'all' && item.kind !== actionKindFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        item.key,
        item.kind,
        item.tone,
        item.title,
        item.meta,
        item.value,
        item.tab,
      ].some(value => String(value ?? '').toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (actionSortMode.value === 'severity') {
        return toneRank[b.tone] - toneRank[a.tone] || b.priority - a.priority || a.title.localeCompare(b.title)
      }
      if (actionSortMode.value === 'title') {
        return a.title.localeCompare(b.title)
      }
      if (actionSortMode.value === 'value') {
        return b.priority - a.priority || String(a.value ?? '').localeCompare(String(b.value ?? '')) || a.title.localeCompare(b.title)
      }
      return b.priority - a.priority || toneRank[b.tone] - toneRank[a.tone] || a.title.localeCompare(b.title)
    })
})

function getToneClassName(tone: AnalyzeActionCenterTone) {
  if (tone === 'critical') {
    return runtimeBadgeStyles({ tone: 'error' })
  }
  if (tone === 'warning') {
    return runtimeBadgeStyles({ tone: 'warning' })
  }
  if (tone === 'success') {
    return runtimeBadgeStyles({ tone: 'success' })
  }
  return runtimeBadgeStyles({ tone: 'info' })
}

function getToneLabel(tone: AnalyzeActionCenterTone) {
  if (tone === 'critical') {
    return '必须处理'
  }
  if (tone === 'warning') {
    return '建议处理'
  }
  if (tone === 'success') {
    return '可查看'
  }
  return '定位'
}
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
    <AppPanelHeader icon-name="metric-health" title="问题中心">
      <template #meta>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
          @click="emit('copyReport')"
        >
          <span class="h-3.5 w-3.5">
            <DashboardIcon name="metric-copy" />
          </span>
          复制 PR
        </button>
      </template>
    </AppPanelHeader>

    <div class="mt-3 grid gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-(--dashboard-text-soft)">
          匹配 {{ filteredActions.length }} / {{ actions.length }} 个处理项
        </p>
        <input
          v-model="actionQuery"
          class="h-9 w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text) outline-none transition placeholder:text-(--dashboard-text-soft) focus:border-(--dashboard-accent) md:w-64"
          placeholder="搜索问题、建议或目标页"
          type="search"
        >
      </div>
      <div class="grid grid-cols-3 gap-2">
        <select
          v-model="actionToneFilter"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="all">
            全部严重度
          </option>
          <option
            v-for="tone in toneOptions"
            :key="tone"
            :value="tone"
          >
            {{ getToneLabel(tone) }}
          </option>
        </select>
        <select
          v-model="actionKindFilter"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="all">
            全部类型
          </option>
          <option
            v-for="kind in kindOptions"
            :key="kind"
            :value="kind"
          >
            {{ getKindLabel(kind) }}
          </option>
        </select>
        <select
          v-model="actionSortMode"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="priority">
            按优先级
          </option>
          <option value="severity">
            按严重度
          </option>
          <option value="title">
            按标题
          </option>
          <option value="value">
            按数值
          </option>
        </select>
      </div>
    </div>

    <div class="mt-3 min-h-0 overflow-hidden">
      <AppEmptyState v-if="filteredActions.length === 0" compact>
        暂无匹配当前筛选条件的事项。
      </AppEmptyState>

      <ol v-else class="grid h-full min-h-0 gap-2 overflow-y-auto pr-1">
        <li
          v-for="item in filteredActions"
          :key="item.key"
          class="list-none"
        >
          <button
            type="button"
            class="w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 text-left transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
            :class="activeKey === item.key ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : undefined"
            @click="emit('select', item)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <span :class="getToneClassName(item.tone)">
                    {{ getToneLabel(item.tone) }}
                  </span>
                  <span class="rounded-full bg-(--dashboard-accent-soft) px-2 py-0.5 text-[11px] text-(--dashboard-text-muted)">
                    {{ getKindLabel(item.kind) }}
                  </span>
                  <p class="truncate text-sm font-medium text-(--dashboard-text)">
                    {{ item.title }}
                  </p>
                </div>
                <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
                  {{ item.meta }}
                </p>
              </div>
              <span
                v-if="item.value"
                class="whitespace-nowrap text-sm font-medium text-(--dashboard-accent)"
              >
                {{ item.value }}
              </span>
            </div>
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>
