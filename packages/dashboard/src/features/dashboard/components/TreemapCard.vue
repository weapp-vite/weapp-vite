<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type {
  AnalyzeSubpackagesResult,
  AnalyzeTreemapColorMode,
  AnalyzeTreemapFilterMode,
  AnalyzeTreemapFilterOption,
  TreemapLegendItem,
  TreemapNode,
  TreemapNodeMeta,
} from '../types'
import { computed } from 'vue'
import { formatBytes } from '../utils/format'
import AppSelect from './AppSelect.vue'
import TreemapSelectionPanel from './TreemapSelectionPanel.vue'

const props = defineProps<{
  bindChartRef: (element: Element | null) => void
  filterMode: AnalyzeTreemapFilterMode
  filterOptions: AnalyzeTreemapFilterOption[]
  canUseSelectedPackageFilter: boolean
  hasComparison: boolean
  comparisonLabel: string
  colorMode: AnalyzeTreemapColorMode
  colorDescription: string
  legend: TreemapLegendItem[]
  nodes: TreemapNode[]
  path: TreemapNode[]
  result: AnalyzeSubpackagesResult
  selectedMeta: TreemapNodeMeta | null
  isEmpty: boolean
}>()

const emit = defineEmits<{
  resetFocus: []
  selectNode: [meta: TreemapNodeMeta]
  openSource: [meta: TreemapNodeMeta]
  inspectProblem: [problem: 'duplicates' | 'growth']
  updateFilterMode: [mode: AnalyzeTreemapFilterMode]
  updateColorMode: [mode: AnalyzeTreemapColorMode]
}>()

const filters = computed(() => props.filterOptions.map(option => ({
  ...option,
  label: option.value === 'growth' && !props.hasComparison ? '增长（无比较快照）' : option.label,
  disabled: (option.value === 'selected-package' && !props.canUseSelectedPackageFilter)
    || (option.value === 'growth' && !props.hasComparison),
})))
const colorOptions = computed<Array<{ value: AnalyzeTreemapColorMode, label: string, disabled?: boolean }>>(() => [
  { value: 'package', label: '所属分包' },
  { value: 'source', label: '模块来源' },
  { value: 'duplicates', label: '重复打包' },
  { value: 'delta', label: props.hasComparison ? '构建增量' : '构建增量（无比较快照）', disabled: !props.hasComparison },
])
const visibleBytes = computed(() => props.nodes.reduce((total, node) => total + node.value, 0))
const buttonClass = 'inline-flex min-h-8 items-center justify-center rounded px-2 text-xs text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) disabled:cursor-not-allowed disabled:opacity-50'

function handleChartRef(element: Element | ComponentPublicInstance | null) {
  props.bindChartRef(element instanceof Element ? element : null)
}
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) xl:h-full" aria-label="体积地图工作台">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--dashboard-border) px-3 py-2">
      <h2 class="mr-auto text-sm font-semibold">
        体积地图 <span class="ml-1 font-mono text-xs font-normal text-(--dashboard-text-muted)">{{ formatBytes(visibleBytes) }}</span>
      </h2>
      <div class="flex min-w-0 items-center gap-2">
        <span class="shrink-0 text-xs text-(--dashboard-text-muted)">显示</span>
        <AppSelect :model-value="filterMode" :options="filters" label="筛选节点" size="sm" @update:model-value="emit('updateFilterMode', $event)" />
      </div>
      <div class="flex min-w-0 items-center gap-2">
        <span class="shrink-0 text-xs text-(--dashboard-text-muted)">着色</span>
        <AppSelect :model-value="colorMode" :options="colorOptions" label="着色方式" size="sm" @update:model-value="emit('updateColorMode', $event)" />
      </div>
      <div class="flex items-center gap-1" aria-label="分析问题">
        <button type="button" :class="buttonClass" @click="emit('inspectProblem', 'duplicates')">
          查重复
        </button>
        <button type="button" :class="buttonClass" :disabled="!hasComparison" :title="hasComparison ? `对比${comparisonLabel}，只看增长部分` : '需要上次构建或选定基线快照'" @click="emit('inspectProblem', 'growth')">
          看增长
        </button>
      </div>
    </div>

    <div class="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="flex min-h-0 flex-col">
        <nav class="flex min-h-10 flex-wrap items-center gap-1 border-b border-(--dashboard-border) px-2 py-1" aria-label="体积地图下钻路径">
          <button type="button" :class="buttonClass" :aria-current="path.length === 0 ? 'location' : undefined" @click="emit('resetFocus')">
            全部产物
          </button>
          <template v-for="(node, index) in path" :key="node.id">
            <span class="text-xs text-(--dashboard-text-soft)" aria-hidden="true">/</span>
            <button
              type="button"
              class="max-w-full break-all text-left" :class="[buttonClass, index === path.length - 1 ? 'font-medium text-(--dashboard-accent)' : undefined]"
              :aria-current="index === path.length - 1 ? 'location' : undefined"
              :title="node.meta.kind === 'package' ? node.meta.packageLabel : node.meta.kind === 'file' ? node.meta.fileName : node.meta.source"
              @click="emit('selectNode', node.meta)"
            >
              {{ node.name }}
            </button>
          </template>
        </nav>
        <div class="relative min-h-[24rem] flex-1 xl:min-h-0">
          <div
            :ref="handleChartRef"
            class="absolute inset-0"
            role="img"
            aria-label="构建产物体积图。可点击节点下钻，也可使用节点详情中的列表选择。"
          />
          <div v-if="isEmpty" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--dashboard-panel) p-6 text-center" role="status">
            <p class="text-sm text-(--dashboard-text-muted)">
              {{ filterMode === 'growth' && !hasComparison ? '没有可比较的构建快照。' : '当前条件下没有匹配的产物。' }}
            </p>
            <button type="button" :class="buttonClass" @click="emit('updateFilterMode', 'all')">
              显示全部产物
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-(--dashboard-border) px-3 py-2 text-[11px] text-(--dashboard-text-muted)">
          <span v-for="item in legend" :key="item.label" class="inline-flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: item.color }" aria-hidden="true" />
            {{ item.label }}
          </span>
          <p class="w-full">
            {{ colorDescription }}<span v-if="colorMode === 'delta' && hasComparison"> · 对比{{ comparisonLabel }}</span>
          </p>
        </div>
      </div>
      <TreemapSelectionPanel
        class="border-t border-(--dashboard-border) p-4 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-t-0"
        :result="result"
        :nodes="nodes"
        :selected-meta="selectedMeta"
        @select-node="emit('selectNode', $event)"
        @open-source="emit('openSource', $event)"
      />
    </div>
  </section>
</template>
