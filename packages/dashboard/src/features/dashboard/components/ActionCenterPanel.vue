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
  let label = '待核实线索'
  let tone: 'neutral' | 'info' | 'warning' | 'error' = 'info'
  if (item.measurementUnknown) {
    label = '测量不完整'
    tone = 'neutral'
  }
  else if (item.kind === 'budget') {
    if (!item.warning || item.warning.status === 'unknown') {
      label = '测量不完整'
      tone = 'neutral'
    }
    else if (item.warning.status === 'critical') {
      label = '超出预算'
      tone = 'error'
    }
    else {
      label = '接近预算'
      tone = 'warning'
    }
  }
  else if (item.kind === 'increment') {
    label = '增长线索'
  }
  else if (item.kind === 'duplicate') {
    label = '重复待核实'
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
    <label :for="searchId" class="sr-only">搜索问题与线索</label>
    <div class="relative min-w-0">
      <span class="icon-[mdi--magnify] pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--dashboard-text-soft)" aria-hidden="true" />
      <input :id="searchId" v-model="actionQuery" data-diagnostic-search class="min-h-9 w-full min-w-0 rounded-sm border border-(--dashboard-border) bg-(--dashboard-panel) pr-2 pl-8 text-sm text-(--dashboard-text) placeholder:text-(--dashboard-text-soft) pointer-coarse:min-h-11" placeholder="搜索名称或路径" type="search" :aria-controls="listId">
    </div>

    <details class="group min-w-0" :open="Boolean(advancedFilterSummary)">
      <summary class="flex min-h-9 cursor-pointer list-none items-center gap-2 py-1 text-xs text-(--dashboard-text-muted) hover:text-(--dashboard-text)">
        <span class="icon-[mdi--filter-outline] size-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0 flex-1">筛选与排序<span v-if="advancedFilterSummary"> · {{ advancedFilterSummary }}</span></span>
        <span class="icon-[mdi--chevron-right] size-4 shrink-0 group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div class="grid min-w-0 gap-2 pt-2">
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
      <ol v-else class="divide-y divide-(--dashboard-border)">
        <li v-for="row in visibleRows" :key="row.item.key" class="min-w-0 list-none">
          <button
            type="button"
            class="min-h-11 w-full min-w-0 border-l-2 px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
            :class="activeKey === row.item.key
              ? 'border-l-(--dashboard-accent) bg-(--dashboard-accent-soft)'
              : 'border-transparent hover:bg-(--dashboard-panel-muted)'"
            :aria-pressed="activeKey === row.item.key"
            :title="row.target"
            :aria-label="`${row.target}，${row.label}${row.item.value ? `，${row.item.value}` : ''}`"
            :data-diagnostic-key="row.item.key"
            @click="emit('select', row.item)"
          >
            <span class="flex min-w-0 items-baseline justify-between gap-2">
              <span class="min-w-0 font-mono text-sm font-medium leading-5 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ row.name }}</span>
              <span v-if="row.item.value" class="max-w-[45%] shrink-0 text-right text-xs font-medium leading-5 tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]">{{ row.item.value }}</span>
            </span>
            <span class="mt-1 flex min-w-0 items-baseline gap-2 text-xs leading-5">
              <span class="shrink-0" :class="row.toneClass">{{ row.label }}</span>
              <span v-if="row.directory" class="min-w-0 truncate text-(--dashboard-text-soft)">{{ row.directory }}</span>
            </span>
          </button>
        </li>
      </ol>
    </div>
  </aside>
</template>
