<script setup lang="ts">
import type { AnalyzeActionCenterItem } from '../types'
import { computed, useId } from 'vue'
import { useActionCenterPanel } from '../composables/useActionCenterPanel'
import { formatModuleIdentifier } from '../utils/format'
import AppEmptyState from './AppEmptyState.vue'
import AppSelect from './AppSelect.vue'

const props = defineProps<{
  actions: AnalyzeActionCenterItem[]
  activeKey: string | null
}>()

const emit = defineEmits<{
  select: [item: AnalyzeActionCenterItem]
}>()

const {
  actionKindFilter,
  actionQuery,
  actionSortMode,
  actionSortOptions,
  actionToneFilter,
  filteredActions,
  getKindLabel,
  getToneLabel,
  kindFilterOptions,
  toneFilterOptions,
} = useActionCenterPanel(props)

const advancedFilterSummary = computed(() => [
  actionToneFilter.value !== 'all' ? getToneLabel(actionToneFilter.value) : '',
  actionKindFilter.value !== 'all' ? getKindLabel(actionKindFilter.value) : '',
  actionSortMode.value !== 'priority' ? actionSortOptions.find(option => option.value === actionSortMode.value)?.label : '',
].filter(Boolean).join(' · '))

const searchId = useId()
const listId = useId()
const visibleRows = computed(() => filteredActions.value.map((item) => {
  let label = '线索 · 待核实'
  let tone: 'neutral' | 'info' | 'warning' | 'error' = 'info'
  if (item.measurementUnknown) {
    label = '未知 · 测量不完整'
    tone = 'neutral'
  }
  else if (item.kind === 'budget') {
    if (!item.warning || item.warning.status === 'unknown') {
      label = '未知 · 测量不完整'
      tone = 'neutral'
    }
    else if (item.warning.status === 'critical') {
      label = '问题 · 超出预算'
      tone = 'error'
    }
    else {
      label = '风险 · 接近预算'
      tone = 'warning'
    }
  }
  else if (item.kind === 'increment') {
    label = '线索 · 增长待查'
  }
  else if (item.kind === 'duplicate') {
    label = '线索 · 重复待核实'
  }
  const target = formatModuleIdentifier(item.targetLabel)
  const separator = target.lastIndexOf('/')
  return {
    item,
    label,
    target,
    name: target.slice(separator + 1),
    directory: separator < 0 ? '' : target.slice(0, separator + 1),
    toneClass: tone === 'error' || tone === 'warning' ? 'text-amber-700 dark:text-amber-200' : 'text-(--dashboard-text-muted)',
  }
}))
</script>

<template>
  <aside data-diagnostic-index aria-label="问题索引" class="grid min-w-0 content-start gap-3">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-sm font-semibold text-(--dashboard-text-muted)">问题与线索</h2>
      <span class="text-xs tabular-nums text-(--dashboard-text-soft)">{{ actions.length }} 项</span>
    </header>

    <details class="group min-w-0" :open="Boolean(actionQuery || advancedFilterSummary)">
      <summary class="flex min-h-9 cursor-pointer list-none items-center gap-2 py-1 text-xs text-(--dashboard-text-muted) hover:text-(--dashboard-text)">
        <span class="icon-[mdi--filter-outline] size-4 shrink-0" aria-hidden="true" />
        <span class="flex-1">搜索与筛选<span v-if="actionQuery || advancedFilterSummary"> · {{ filteredActions.length }} 项匹配</span></span>
        <span class="icon-[mdi--chevron-right] size-4 shrink-0 group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div class="grid min-w-0 gap-2 pt-2">
        <label :for="searchId" class="sr-only">搜索问题与线索</label>
        <input :id="searchId" v-model="actionQuery" data-diagnostic-search class="min-h-11 w-full min-w-0 rounded-sm border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm text-(--dashboard-text) placeholder:text-(--dashboard-text-soft)" placeholder="搜索问题或路径" type="search" :aria-controls="listId">
        <AppSelect v-model="actionToneFilter" label="按严重度筛选" :options="toneFilterOptions" />
        <AppSelect v-model="actionKindFilter" label="按问题类型筛选" :options="kindFilterOptions" />
        <AppSelect v-model="actionSortMode" label="排序处理项" :options="actionSortOptions" />
      </div>
    </details>

    <p v-if="actionQuery || advancedFilterSummary" class="text-xs tabular-nums text-(--dashboard-text-soft)" role="status">
      匹配 {{ filteredActions.length }} / {{ actions.length }} 项
    </p>
    <div :id="listId" class="max-h-[min(32rem,45dvh)] min-w-0 overflow-y-auto p-0.5">
      <AppEmptyState v-if="filteredActions.length === 0" compact>
        {{ actions.length === 0 ? '当前没有问题或待查线索。' : '没有匹配项，请调整搜索或筛选。' }}
      </AppEmptyState>
      <ol v-else class="grid gap-1">
        <li v-for="(row, index) in visibleRows" :key="row.item.key" class="min-w-0 list-none">
          <button
            type="button"
            class="w-full min-w-0 border border-l-2 px-3.5 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
            :class="activeKey === row.item.key
              ? 'border-(--dashboard-border) border-l-(--dashboard-accent) bg-(--dashboard-panel)'
              : 'border-transparent hover:bg-(--dashboard-panel-muted)'"
            :aria-pressed="activeKey === row.item.key"
            :title="row.target"
            :data-diagnostic-key="row.item.key"
            @click="emit('select', row.item)"
          >
            <span class="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <span class="text-xs" :class="row.toneClass">{{ String(index + 1).padStart(2, '0') }} / {{ row.label }}</span>
              <span v-if="row.item.value" class="text-xs font-medium tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]">
                {{ row.item.value }}
              </span>
            </span>
            <span class="mt-2 line-clamp-2 text-sm font-medium leading-5 text-(--dashboard-text) [overflow-wrap:anywhere]">
              {{ row.name }}
            </span>
            <span v-if="row.directory" class="mt-1 block truncate text-xs leading-5 text-(--dashboard-text-muted)">
              {{ row.directory }}
            </span>
          </button>
        </li>
      </ol>
    </div>
  </aside>
</template>
