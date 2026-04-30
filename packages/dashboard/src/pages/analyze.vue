<script setup lang="ts">
import type { DashboardInfoPillItem, LargestFileEntry, PackageBudgetWarning, SelectedFileModuleDetail, TreemapNodeMeta } from '../features/dashboard/types'
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppInfoPill from '../features/dashboard/components/AppInfoPill.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import DashboardMetricGrid from '../features/dashboard/components/DashboardMetricGrid.vue'
import ModulesPanel from '../features/dashboard/components/ModulesPanel.vue'
import OverviewPanel from '../features/dashboard/components/OverviewPanel.vue'
import PackagesPanel from '../features/dashboard/components/PackagesPanel.vue'
import { useAnalyzeDashboardData } from '../features/dashboard/composables/useAnalyzeDashboardData'
import { useDashboardPage } from '../features/dashboard/composables/useDashboardPage'
import { useDashboardTheme } from '../features/dashboard/composables/useDashboardTheme'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { useTreemapData } from '../features/dashboard/composables/useTreemapData'
import { dashboardTabs } from '../features/dashboard/constants/view'
import { formatBytes } from '../features/dashboard/utils/format'
import { pillButtonStyles } from '../features/dashboard/utils/styles'
import { createTreemapFileNodeId, createTreemapPackageNodeId } from '../features/dashboard/utils/treemap'
import 'echarts/theme/dark'

echarts.use([
  TreemapChart,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const chartRef = shallowRef<HTMLDivElement>()
const selectedTreemapMeta = shallowRef<TreemapNodeMeta | null>(null)
const selectedLargestFile = shallowRef<LargestFileEntry | null>(null)
const selectedBudgetWarning = shallowRef<PackageBudgetWarning | null>(null)
const exportStatus = shallowRef('')
let chart: echarts.ECharts | undefined
const { resolvedTheme } = useDashboardTheme()
const { lastUpdatedAt, previousResultRef, resultRef, updateCount } = useDashboardWorkspace()

const { treemapOption } = useTreemapData(resultRef, resolvedTheme)
const {
  summary,
  packageTypeSummary,
  packageInsights,
  largestFiles,
  duplicateModules,
  moduleSourceSummary,
  budgetWarnings,
  budgetLimitItems,
} = useAnalyzeDashboardData(resultRef, previousResultRef)

function filterLargestFiles(files: LargestFileEntry[], meta: TreemapNodeMeta | null, warning: PackageBudgetWarning | null) {
  if (warning && warning.scope !== 'total') {
    return files.filter(file => file.packageId === warning.id)
  }
  if (!meta) {
    return files
  }
  if (meta.kind === 'package') {
    return files.filter(file => file.packageId === meta.packageId)
  }
  if (meta.kind === 'file' || meta.kind === 'asset' || meta.kind === 'module') {
    return files.filter(file => file.packageId === meta.packageId && file.file === meta.fileName)
  }
  return files
}

const filteredDuplicateModules = computed(() => {
  if (selectedTreemapMeta.value?.kind !== 'module') {
    return duplicateModules.value
  }
  return duplicateModules.value.filter(module => module.source === selectedTreemapMeta.value?.source)
})
const visibleDuplicateModules = computed(() => filteredDuplicateModules.value.slice(0, 12))
const filteredLargestFiles = computed(() => filterLargestFiles(largestFiles.value, selectedTreemapMeta.value, selectedBudgetWarning.value))
const visibleLargestFiles = computed(() => filteredLargestFiles.value.slice(0, 10))
const activeLargestFileKey = computed(() => selectedLargestFile.value
  ? `${selectedLargestFile.value.packageId}:${selectedLargestFile.value.file}`
  : null)
const selectedTreemapFocusNodeId = computed(() => {
  if (selectedLargestFile.value) {
    return createTreemapFileNodeId(selectedLargestFile.value.packageId, selectedLargestFile.value.file)
  }
  return selectedTreemapMeta.value?.nodeId ?? null
})
const selectedFileEntry = computed(() => {
  if (selectedLargestFile.value) {
    return selectedLargestFile.value
  }
  const meta = selectedTreemapMeta.value
  if (!meta || meta.kind === 'package') {
    return null
  }
  return largestFiles.value.find(file => file.packageId === meta.packageId && file.file === meta.fileName) ?? null
})
const duplicateModuleMap = computed(() => new Map(duplicateModules.value.map(module => [module.id, module])))
const selectedFileModules = computed<SelectedFileModuleDetail[]>(() => {
  return (selectedFileEntry.value?.modules ?? [])
    .map((module) => {
      const duplicate = duplicateModuleMap.value.get(module.id)
      const bytes = module.bytes ?? module.originalBytes ?? 0
      return {
        key: module.id,
        source: module.source,
        sourceType: module.sourceType,
        bytes,
        originalBytes: module.originalBytes,
        duplicatePackageCount: duplicate?.packageCount ?? 1,
        estimatedSavingBytes: duplicate?.estimatedSavingBytes ?? 0,
      }
    })
    .sort((a, b) =>
      b.estimatedSavingBytes - a.estimatedSavingBytes
      || b.bytes - a.bytes
      || a.source.localeCompare(b.source),
    )
})
const statusText = computed(() => `${updateCount.value} 次数据同步`)
const statusTone = computed(() => resolvedTheme.value === 'dark' ? 'status-dark' : 'status-light')
const statusPills = computed<DashboardInfoPillItem[]>(() => [
  {
    iconName: statusTone.value,
    label: statusText.value,
  },
  {
    label: lastUpdatedAt.value,
  },
])
const { activeTab, topCards, packageTypeSummary: metricPackageTypeSummary } = useDashboardPage({
  summary,
  packageInsights,
  packageTypeSummary,
  duplicateModules,
  moduleSourceSummary,
  lastUpdatedAt,
})

const exportSummaryText = computed(() => {
  const summaryValue = summary.value
  const topPackage = packageInsights.value[0]
  const topDuplicate = duplicateModules.value[0]
  return [
    `总产物体积：${formatBytes(summaryValue.totalBytes)}`,
    `Gzip：${formatBytes(summaryValue.gzipBytes)}`,
    `Brotli/压缩后：${formatBytes(summaryValue.compressedBytes)}`,
    `包体：${summaryValue.packageCount} 个，分包配置：${summaryValue.subpackageCount} 个`,
    `模块：${summaryValue.moduleCount} 个，跨包复用：${summaryValue.duplicateCount} 个`,
    `预算告警：${summaryValue.budgetWarningCount} 个`,
    topPackage ? `最大包：${topPackage.label} ${formatBytes(topPackage.totalBytes)}` : '',
    topDuplicate ? `首要重复模块：${topDuplicate.source}，估算可节省 ${formatBytes(topDuplicate.estimatedSavingBytes)}（${topDuplicate.advice}）` : '',
  ].filter(Boolean).join('\n')
})

const exportMarkdownText = computed(() => {
  const summaryValue = summary.value
  const packageRows = packageInsights.value
    .map(pkg => `| ${pkg.label} | ${pkg.type} | ${formatBytes(pkg.totalBytes)} | ${formatBytes(pkg.compressedBytes)} | ${typeof pkg.sizeDeltaBytes === 'number' ? `${pkg.sizeDeltaBytes > 0 ? '+' : '-'}${formatBytes(Math.abs(pkg.sizeDeltaBytes))}` : '无变化'} |`)
    .join('\n')
  const topFileRows = largestFiles.value.slice(0, 10)
    .map(file => `| ${file.file} | ${file.packageLabel} | ${file.type} | ${formatBytes(file.size)} | ${formatBytes(file.compressedSize)} |`)
    .join('\n')
  const duplicateRows = duplicateModules.value.slice(0, 10)
    .map(module => `| ${module.source} | ${module.sourceType} | ${module.packageCount} | ${formatBytes(module.estimatedSavingBytes)} | ${module.advice} |`)
    .join('\n')
  const budgetRows = budgetWarnings.value
    .map(item => `| ${item.label} | ${item.scope} | ${formatBytes(item.currentBytes)} | ${formatBytes(item.limitBytes)} | ${item.status === 'critical' ? '超预算' : '接近预算'} ${(item.ratio * 100).toFixed(1)}% |`)
    .join('\n')
  const topDuplicate = duplicateModules.value.find(module => module.estimatedSavingBytes > 0)

  return [
    '# weapp-vite analyze 报告',
    '',
    `生成时间：${resultRef.value?.metadata?.generatedAt ?? new Date().toISOString()}`,
    '',
    '## 本次变化摘要',
    '',
    `- 总产物体积：${formatBytes(summaryValue.totalBytes)}`,
    `- 压缩后体积：${formatBytes(summaryValue.compressedBytes)}`,
    `- 包体数量：${summaryValue.packageCount}`,
    `- 源码模块：${summaryValue.moduleCount}`,
    `- 跨包复用：${summaryValue.duplicateCount}`,
    `- 预算告警：${summaryValue.budgetWarningCount}`,
    '',
    '## 预算告警',
    '',
    '| 对象 | 范围 | 当前体积 | 预算 | 状态 |',
    '| --- | --- | ---: | ---: | --- |',
    budgetRows || '| - | - | 0 B | 0 B | 正常 |',
    '',
    '## 建议动作',
    '',
    budgetWarnings.value[0]
      ? `- 优先处理 ${budgetWarnings.value[0].label}：当前 ${formatBytes(budgetWarnings.value[0].currentBytes)}，预算 ${formatBytes(budgetWarnings.value[0].limitBytes)}。`
      : '- 当前没有预算超限或接近预算的包体。',
    topDuplicate
      ? `- 优先处理重复模块 ${topDuplicate.source}，估算可节省 ${formatBytes(topDuplicate.estimatedSavingBytes)}。`
      : '- 当前没有可估算收益的重复模块。',
    '',
    '## 包体',
    '',
    '| 包 | 类型 | 体积 | 压缩后 | 较上次 |',
    '| --- | --- | ---: | ---: | ---: |',
    packageRows || '| - | - | 0 B | 0 B | 无变化 |',
    '',
    '## Top 文件',
    '',
    '| 文件 | 包 | 类型 | 体积 | 压缩后 |',
    '| --- | --- | --- | ---: | ---: |',
    topFileRows || '| - | - | - | 0 B | 0 B |',
    '',
    '## 重复模块',
    '',
    '| 模块 | 来源 | 包数量 | 估算可节省 | 建议 |',
    '| --- | --- | ---: | ---: | --- |',
    duplicateRows || '| - | - | 0 | 0 B | - |',
    '',
  ].join('\n')
})

function handleResize() {
  chart?.resize()
}

function destroyChart() {
  chart?.dispose()
  chart = undefined
}

function bindChartRef(element: Element | null) {
  chartRef.value = element instanceof HTMLDivElement
    ? element
    : undefined
}

function handleChartClick(params: { data?: { meta?: TreemapNodeMeta } }) {
  selectedTreemapMeta.value = params.data?.meta ?? null
  selectedLargestFile.value = null
  selectedBudgetWarning.value = null
}

function handleSelectLargestFile(file: LargestFileEntry) {
  selectedLargestFile.value = file
  selectedTreemapMeta.value = {
    kind: 'file',
    nodeId: createTreemapFileNodeId(file.packageId, file.file),
    packageId: file.packageId,
    packageLabel: file.packageLabel,
    fileName: file.file,
    from: file.from,
    childCount: file.moduleCount,
    type: file.type,
    bytes: file.size,
  }
}

function handleSelectBudgetWarning(warning: PackageBudgetWarning) {
  selectedBudgetWarning.value = warning
  selectedLargestFile.value = filterLargestFiles(largestFiles.value, null, warning)[0] ?? null

  if (!selectedLargestFile.value) {
    selectedTreemapMeta.value = null
    return
  }

  if (warning.scope === 'total') {
    selectedTreemapMeta.value = null
    return
  }

  const packageInfo = packageInsights.value.find(pkg => pkg.id === warning.id)
  selectedTreemapMeta.value = packageInfo
    ? {
        kind: 'package',
        nodeId: createTreemapPackageNodeId(packageInfo.id),
        packageId: packageInfo.id,
        packageLabel: packageInfo.label,
        packageType: packageInfo.type,
        fileCount: packageInfo.fileCount,
        totalBytes: packageInfo.totalBytes,
      }
    : null
}

function focusTreemapNode(nodeId: string) {
  chart?.dispatchAction({
    type: 'treemapRootToNode',
    seriesIndex: 0,
    targetNodeId: nodeId,
  })
}

function handleFocusTreemapSelection() {
  if (!selectedTreemapFocusNodeId.value) {
    return
  }
  focusTreemapNode(selectedTreemapFocusNodeId.value)
}

function handleResetTreemapFocus() {
  chart?.setOption(treemapOption.value, true)
  chart?.resize()
}

async function ensureChart() {
  if (activeTab.value !== 'overview') {
    destroyChart()
    return
  }

  await nextTick()

  if (!chartRef.value) {
    return
  }

  if (!chart) {
    chart = echarts.init(chartRef.value, resolvedTheme.value === 'dark' ? 'dark' : undefined, { renderer: 'canvas' })
    chart.on('click', handleChartClick)
  }

  chart.setOption(treemapOption.value, true)
  chart.resize()
}

async function copySummary() {
  await navigator.clipboard.writeText(exportSummaryText.value)
  exportStatus.value = '已复制'
}

function exportJson() {
  if (!resultRef.value) {
    return
  }
  const blob = new Blob([`${JSON.stringify(resultRef.value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-analyze.json'
  anchor.click()
  URL.revokeObjectURL(url)
  exportStatus.value = '已导出'
}

function exportMarkdown() {
  const blob = new Blob([`${exportMarkdownText.value}\n`], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-analyze.md'
  anchor.click()
  URL.revokeObjectURL(url)
  exportStatus.value = '已导出 MD'
}

watch(
  treemapOption,
  (newOption) => {
    if (chart) {
      chart.setOption(newOption, true)
    }
  },
  { deep: true },
)

watch(activeTab, () => {
  void ensureChart()
})

watch(resultRef, () => {
  selectedTreemapMeta.value = null
  selectedLargestFile.value = null
  selectedBudgetWarning.value = null
})

watch(resolvedTheme, async () => {
  if (chart && chartRef.value) {
    destroyChart()
  }
  await ensureChart()
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
  void ensureChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  destroyChart()
})
</script>

<template>
  <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
    <AppSurfaceCard
      v-if="!resultRef"
      eyebrow="Analyze"
      title="等待分析数据注入"
      icon-name="hero-commands"
      tone="strong"
      padding="header"
    >
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.92fr)]">
        <div class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-4">
          <p class="text-[11px] uppercase tracking-[0.24em] text-(--dashboard-text-soft)">
            recommended commands
          </p>
          <div class="mt-4 grid gap-2">
            <code
              v-for="command in [
                'weapp-vite analyze',
                'weapp-vite build --ui',
                'weapp-vite dev --ui',
              ]"
              :key="command"
              class="rounded-md bg-slate-950 px-3 py-3 text-xs text-slate-100 dark:bg-slate-900"
            >
              {{ command }}
            </code>
          </div>
        </div>

        <div class="grid gap-2">
          <RouterLink
            class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-4 py-4 transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
            to="/"
          >
            <p class="font-medium">
              返回工作台
            </p>
            <p class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
              查看当前状态和命令。
            </p>
          </RouterLink>
          <RouterLink
            class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-4 py-4 transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
            to="/activity"
          >
            <p class="font-medium">
              查看活动流
            </p>
            <p class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
              观察命令、构建、HMR 和诊断事件。
            </p>
          </RouterLink>
        </div>
      </div>
    </AppSurfaceCard>

    <section class="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <nav class="flex flex-wrap gap-2">
        <button
          v-for="tab in dashboardTabs"
          :key="tab.key"
          :class="pillButtonStyles({ kind: 'nav', active: activeTab === tab.key })"
          @click="activeTab = tab.key"
        >
          <span class="h-4.5 w-4.5">
            <DashboardIcon :name="tab.iconName" />
          </span>
          {{ tab.label }}
        </button>
      </nav>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="resultRef"
          :class="pillButtonStyles({ kind: 'nav', active: false })"
          @click="copySummary"
        >
          <span class="h-4.5 w-4.5">
            <DashboardIcon name="metric-copy" />
          </span>
          复制摘要
        </button>
        <button
          v-if="resultRef"
          :class="pillButtonStyles({ kind: 'nav', active: false })"
          @click="exportJson"
        >
          <span class="h-4.5 w-4.5">
            <DashboardIcon name="metric-size-outline" />
          </span>
          导出 JSON
        </button>
        <button
          v-if="resultRef"
          :class="pillButtonStyles({ kind: 'nav', active: false })"
          @click="exportMarkdown"
        >
          <span class="h-4.5 w-4.5">
            <DashboardIcon name="file-samples" />
          </span>
          导出 MD
        </button>
        <AppInfoPill
          v-if="exportStatus"
          :label="exportStatus"
          uppercase
        />
        <AppInfoPill
          v-for="item in statusPills"
          :key="item.label"
          v-bind="item"
          uppercase
        />
      </div>
    </section>

    <template v-if="resultRef">
      <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
        <DashboardMetricGrid :cards="topCards" :package-type-summary="metricPackageTypeSummary" compact />

        <section v-if="activeTab === 'overview'" class="min-h-0 overflow-hidden">
          <OverviewPanel
            :bind-chart-ref="bindChartRef"
            :can-focus-treemap-selection="Boolean(selectedTreemapFocusNodeId)"
            :visible-largest-files="visibleLargestFiles"
            :selected-file-modules="selectedFileModules"
            :budget-warnings="budgetWarnings"
            :budget-limit-items="budgetLimitItems"
            :active-budget-warning-id="selectedBudgetWarning?.id ?? null"
            :active-largest-file-key="activeLargestFileKey"
            :selected-treemap-meta="selectedTreemapMeta"
            @focus-treemap-selection="handleFocusTreemapSelection"
            @reset-treemap-focus="handleResetTreemapFocus"
            @select-budget-warning="handleSelectBudgetWarning"
            @select-file="handleSelectLargestFile"
          />
        </section>

        <section v-else-if="activeTab === 'packages'" class="min-h-0 overflow-hidden">
          <PackagesPanel
            :package-insights="packageInsights"
            :budget-warnings="budgetWarnings"
            :selected-treemap-meta="selectedTreemapMeta"
          />
        </section>

        <section v-else class="min-h-0 overflow-hidden">
          <ModulesPanel
            :visible-duplicate-modules="visibleDuplicateModules"
            :module-source-summary="moduleSourceSummary"
            :visible-largest-files="visibleLargestFiles"
          />
        </section>
      </div>
    </template>
  </div>
</template>
