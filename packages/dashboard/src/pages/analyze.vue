<script setup lang="ts">
import type { AnalyzeActionCenterItem, AnalyzeTreemapFilterMode, DashboardInfoPillItem, LargestFileEntry, PackageBudgetWarning, PackageInsight, SelectedFileModuleDetail, TreemapNodeMeta } from '../features/dashboard/types'
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ActionCenterPanel from '../features/dashboard/components/ActionCenterPanel.vue'
import AnalyzeCommandPalette from '../features/dashboard/components/AnalyzeCommandPalette.vue'
import AnalyzeDetailsPanel from '../features/dashboard/components/AnalyzeDetailsPanel.vue'
import AnalyzeDraggableGrid from '../features/dashboard/components/AnalyzeDraggableGrid.vue'
import AnalyzeOverviewPanel from '../features/dashboard/components/AnalyzeOverviewPanel.vue'
import AppInfoPill from '../features/dashboard/components/AppInfoPill.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import HistoryBaselinePanel from '../features/dashboard/components/HistoryBaselinePanel.vue'
import ModulesPanel from '../features/dashboard/components/ModulesPanel.vue'
import PackagesPanel from '../features/dashboard/components/PackagesPanel.vue'
import TreemapCard from '../features/dashboard/components/TreemapCard.vue'
import { useAnalyzeActionCenter } from '../features/dashboard/composables/useAnalyzeActionCenter'
import { useAnalyzeCommandPalette } from '../features/dashboard/composables/useAnalyzeCommandPalette'
import { useAnalyzeDashboardData } from '../features/dashboard/composables/useAnalyzeDashboardData'
import { useDashboardPage } from '../features/dashboard/composables/useDashboardPage'
import { useDashboardTheme } from '../features/dashboard/composables/useDashboardTheme'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { useTreemapData } from '../features/dashboard/composables/useTreemapData'
import { dashboardTabs, treemapFilterOptions } from '../features/dashboard/constants/view'
import { formatBytes } from '../features/dashboard/utils/format'
import { pillButtonStyles } from '../features/dashboard/utils/styles'
import { createTreemapFileNodeId, createTreemapPackageNodeId } from '../features/dashboard/utils/treemap'
import 'echarts/theme/dark.js'

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
const selectedActionKey = shallowRef<string | null>(null)
const commandPaletteOpen = shallowRef(false)
const moreMenuOpen = shallowRef(false)
const exportStatus = shallowRef('')
let chart: echarts.ECharts | undefined
const route = useRoute()
const router = useRouter()
const overviewLayoutItems = [
  { id: 'metrics', label: '关键指标' },
]
const diagnosticsLayoutItems = [
  { id: 'actions', label: '问题中心' },
  { id: 'history', label: '历史基线' },
]
const treemapLayoutItems = [
  { id: 'treemap', label: '体积地图' },
]
const packagesLayoutItems = [
  { id: 'packages', label: '包与产物' },
]
const modulesLayoutItems = [
  { id: 'modules', label: '模块复用' },
]
const { resolvedTheme } = useDashboardTheme()
const {
  baselineSnapshotId,
  comparisonMode,
  comparisonResultRef,
  historySnapshots,
  lastUpdatedAt,
  resultRef,
  setBaselineSnapshot,
  setComparisonMode,
  updateCount,
} = useDashboardWorkspace()

const {
  summary,
  packageTypeSummary,
  packageInsights,
  largestFiles,
  duplicateModules,
  moduleSourceSummary,
  budgetWarnings,
  budgetLimitItems,
  incrementAttribution,
  incrementSummary,
} = useAnalyzeDashboardData(resultRef, comparisonResultRef)

function resolveTreemapFilterMode(value: unknown): AnalyzeTreemapFilterMode {
  return treemapFilterOptions.some(option => option.value === value)
    ? value as AnalyzeTreemapFilterMode
    : 'all'
}

const treemapFilterMode = computed<AnalyzeTreemapFilterMode>({
  get() {
    return resolveTreemapFilterMode(route.query.filter)
  },
  set(value) {
    const query = { ...route.query }
    if (value === 'all') {
      delete query.filter
    }
    else {
      query.filter = value
    }
    void router.replace({ query })
  },
})

const growthFileKeys = computed(() =>
  new Set(incrementAttribution.value
    .filter(item => item.packageId && item.file)
    .map(item => `${item.packageId}\u0000${item.file}`)),
)
const growthModuleIds = computed(() =>
  new Set(incrementAttribution.value
    .map(item => item.moduleId)
    .filter((id): id is string => Boolean(id))),
)
const duplicateModuleIds = computed(() => new Set(duplicateModules.value.map(module => module.id)))
const selectedPackageId = computed(() => {
  if (selectedTreemapMeta.value?.packageId) {
    return selectedTreemapMeta.value.packageId
  }
  if (selectedLargestFile.value?.packageId) {
    return selectedLargestFile.value.packageId
  }
  if (selectedBudgetWarning.value && selectedBudgetWarning.value.scope !== 'total') {
    return selectedBudgetWarning.value.id
  }
  return null
})
const treemapFilterState = computed(() => ({
  mode: treemapFilterMode.value,
  selectedPackageId: selectedPackageId.value,
  growthFileKeys: growthFileKeys.value,
  growthModuleIds: growthModuleIds.value,
  duplicateModuleIds: duplicateModuleIds.value,
}))
const { treemapOption, treemapNodes } = useTreemapData(resultRef, resolvedTheme, treemapFilterState)
const isTreemapEmpty = computed(() => resultRef.value !== null && treemapNodes.value.length === 0)
const canUseSelectedPackageFilter = computed(() => Boolean(selectedPackageId.value))

function matchesTreemapFilter(file: LargestFileEntry) {
  if (treemapFilterMode.value === 'all') {
    return true
  }
  if (treemapFilterMode.value === 'selected-package') {
    return selectedPackageId.value ? file.packageId === selectedPackageId.value : false
  }
  if (treemapFilterMode.value === 'growth') {
    return growthFileKeys.value.has(`${file.packageId}\u0000${file.file}`) || (file.modules ?? []).some(module => growthModuleIds.value.has(module.id))
  }
  if (treemapFilterMode.value === 'duplicates') {
    return (file.modules ?? []).some(module => duplicateModuleIds.value.has(module.id))
  }
  if (treemapFilterMode.value === 'node_modules') {
    return (file.modules ?? []).some(module => module.sourceType === 'node_modules')
  }
  return file.type === 'asset' || (file.modules ?? []).some(module => module.sourceType === 'src' || module.sourceType === 'workspace')
}

function filterLargestFiles(files: LargestFileEntry[], meta: TreemapNodeMeta | null, warning: PackageBudgetWarning | null) {
  const modeFilteredFiles = files.filter(matchesTreemapFilter)
  if (warning && warning.scope !== 'total') {
    return modeFilteredFiles.filter(file => file.packageId === warning.id)
  }
  if (!meta) {
    return modeFilteredFiles
  }
  if (meta.kind === 'package') {
    return modeFilteredFiles.filter(file => file.packageId === meta.packageId)
  }
  if (meta.kind === 'file' || meta.kind === 'asset' || meta.kind === 'module') {
    return modeFilteredFiles.filter(file => file.packageId === meta.packageId && file.file === meta.fileName)
  }
  return modeFilteredFiles
}

const filteredDuplicateModules = computed(() => {
  const meta = selectedTreemapMeta.value
  if (meta?.kind !== 'module') {
    return duplicateModules.value
  }
  return duplicateModules.value.filter(module => module.source === meta.source)
})
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
    .filter((module) => {
      if (treemapFilterMode.value === 'growth') {
        return growthModuleIds.value.has(module.id)
      }
      if (treemapFilterMode.value === 'duplicates') {
        return duplicateModuleIds.value.has(module.id)
      }
      if (treemapFilterMode.value === 'node_modules') {
        return module.sourceType === 'node_modules'
      }
      if (treemapFilterMode.value === 'source') {
        return module.sourceType === 'src' || module.sourceType === 'workspace'
      }
      return true
    })
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
const { actionItems } = useAnalyzeActionCenter({
  budgetWarnings,
  incrementAttribution,
  duplicateModules,
  largestFiles,
  packageInsights,
})
const { commandItems } = useAnalyzeCommandPalette({
  actionItems,
  budgetWarnings,
  duplicateModules,
  incrementAttribution,
  largestFiles,
  packageInsights,
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

const exportPrMarkdownText = computed(() => {
  const summaryValue = summary.value
  const topIncrementRows = incrementAttribution.value.slice(0, 8)
    .map(item => `| ${item.label} | ${item.category} | ${item.packageLabel} | +${formatBytes(item.deltaBytes)} | ${item.advice} |`)
    .join('\n')
  const incrementSummaryRows = incrementSummary.value.slice(0, 6)
    .map(item => `| ${item.category} | ${item.count} | +${formatBytes(item.deltaBytes)} |`)
    .join('\n')
  const budgetRows = budgetWarnings.value.slice(0, 5)
    .map(item => `| ${item.label} | ${formatBytes(item.currentBytes)} | ${formatBytes(item.limitBytes)} | ${item.status === 'critical' ? '超预算' : '接近预算'} ${(item.ratio * 100).toFixed(1)}% |`)
    .join('\n')
  const duplicateRows = duplicateModules.value.slice(0, 5)
    .map(module => `| ${module.source} | ${module.packageCount} | ${formatBytes(module.estimatedSavingBytes)} | ${module.advice} |`)
    .join('\n')
  return [
    '## weapp-vite analyze PR 摘要',
    '',
    `- 总产物体积：${formatBytes(summaryValue.totalBytes)}${typeof summaryValue.sizeDeltaBytes === 'number' ? `（较上次 ${summaryValue.sizeDeltaBytes >= 0 ? '+' : '-'}${formatBytes(Math.abs(summaryValue.sizeDeltaBytes))}）` : ''}`,
    `- 压缩后体积：${formatBytes(summaryValue.compressedBytes)}`,
    `- 预算告警：${budgetWarnings.value.length}`,
    `- 增量归因：${incrementAttribution.value.length > 0 ? `${incrementAttribution.value.length} 项正向增长` : '无正向增长'}`,
    `- 跨包复用：${duplicateModules.value.length}`,
    '',
    '### 增量来源',
    '',
    '| 来源 | 项数 | 增量 |',
    '| --- | ---: | ---: |',
    incrementSummaryRows || '| - | 0 | 0 B |',
    '',
    '### Top 增量',
    '',
    '| 文件/模块 | 来源 | 包 | 增量 | 建议 |',
    '| --- | --- | --- | ---: | --- |',
    topIncrementRows || '| - | - | - | 0 B | - |',
    '',
    '### 预算状态',
    '',
    '| 对象 | 当前体积 | 预算 | 状态 |',
    '| --- | ---: | ---: | --- |',
    budgetRows || '| - | 0 B | 0 B | 正常 |',
    '',
    '### 重复模块',
    '',
    '| 模块 | 包数量 | 估算可节省 | 建议 |',
    '| --- | ---: | ---: | --- |',
    duplicateRows || '| - | 0 | 0 B | - |',
    '',
  ].join('\n')
})

function escapeCsvCell(value: string | number | undefined) {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) {
    return text
  }
  return `"${text.replaceAll('"', '""')}"`
}

function createCsvRow(values: Array<string | number | undefined>) {
  return values.map(escapeCsvCell).join(',')
}

const exportCsvText = computed(() => {
  const rows = [
    createCsvRow(['section', 'label', 'package', 'type', 'sizeBytes', 'compressedBytes', 'deltaBytes', 'count', 'detail']),
  ]

  for (const pkg of packageInsights.value) {
    rows.push(createCsvRow([
      'package',
      pkg.label,
      pkg.id,
      pkg.type,
      pkg.totalBytes,
      pkg.compressedBytes,
      pkg.sizeDeltaBytes,
      pkg.fileCount,
      `${pkg.moduleCount} modules; ${pkg.duplicateModuleCount} duplicate modules`,
    ]))
  }

  for (const file of largestFiles.value) {
    rows.push(createCsvRow([
      'file',
      file.file,
      file.packageLabel,
      file.type,
      file.size,
      file.compressedSize,
      file.sizeDeltaBytes,
      file.moduleCount,
      file.source ?? file.from,
    ]))
  }

  for (const module of duplicateModules.value) {
    rows.push(createCsvRow([
      'duplicate-module',
      module.source,
      module.packages.map(pkg => pkg.packageLabel).join('; '),
      module.sourceType,
      module.bytes,
      module.estimatedSavingBytes,
      undefined,
      module.packageCount,
      module.advice,
    ]))
  }

  for (const item of incrementAttribution.value) {
    rows.push(createCsvRow([
      'increment',
      item.label,
      item.packageLabel,
      item.category,
      item.currentBytes,
      item.deltaBytes,
      item.deltaBytes,
      1,
      item.advice,
    ]))
  }

  return rows.join('\n')
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

function handleChartClick(params: unknown) {
  selectedTreemapMeta.value = (params as { data?: { meta?: TreemapNodeMeta } | null }).data?.meta ?? null
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

function handleSelectPackageInsight(item: PackageInsight) {
  activeTab.value = 'packages'
  selectedTreemapMeta.value = {
    kind: 'package',
    nodeId: createTreemapPackageNodeId(item.id),
    packageId: item.id,
    packageLabel: item.label,
    packageType: item.type,
    fileCount: item.fileCount,
    totalBytes: item.totalBytes,
  }
  selectedLargestFile.value = null
  selectedBudgetWarning.value = null
  treemapFilterMode.value = 'selected-package'
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

function handleUpdateTreemapFilterMode(mode: AnalyzeTreemapFilterMode) {
  if (mode === 'selected-package' && !selectedPackageId.value) {
    return
  }
  treemapFilterMode.value = mode
}

function handleSelectAction(item: AnalyzeActionCenterItem) {
  selectedActionKey.value = item.key
  if (item.kind === 'increment') {
    treemapFilterMode.value = 'growth'
  }
  else if (item.kind === 'duplicate') {
    treemapFilterMode.value = 'duplicates'
  }

  if (item.warning) {
    activeTab.value = 'files'
    handleSelectBudgetWarning(item.warning)
    treemapFilterMode.value = 'selected-package'
    return
  }

  if (item.file) {
    activeTab.value = 'files'
    handleSelectLargestFile(item.file)
    treemapFilterMode.value = 'selected-package'
    return
  }

  if (item.moduleMeta) {
    activeTab.value = item.tab
    selectedTreemapMeta.value = item.moduleMeta
    selectedLargestFile.value = null
    selectedBudgetWarning.value = null
    return
  }

  activeTab.value = item.tab
}

function handleSelectCommand(item: (typeof commandItems.value)[number]) {
  if (item.action) {
    handleSelectAction(item.action)
    return
  }

  if (item.warning) {
    activeTab.value = 'files'
    handleSelectBudgetWarning(item.warning)
    treemapFilterMode.value = 'selected-package'
    return
  }

  if (item.file) {
    activeTab.value = 'files'
    handleSelectLargestFile(item.file)
    treemapFilterMode.value = 'selected-package'
    return
  }

  if (item.moduleMeta) {
    activeTab.value = item.tab
    selectedTreemapMeta.value = item.moduleMeta
    selectedLargestFile.value = null
    selectedBudgetWarning.value = null
    treemapFilterMode.value = item.kind === 'increment' ? 'growth' : 'duplicates'
    return
  }

  if (item.packageMeta) {
    activeTab.value = item.tab
    selectedTreemapMeta.value = item.packageMeta
    selectedLargestFile.value = null
    selectedBudgetWarning.value = null
    treemapFilterMode.value = 'selected-package'
    return
  }

  activeTab.value = item.tab
}

function handleResetTreemapFocus() {
  chart?.setOption(treemapOption.value, true)
  chart?.resize()
}

async function ensureChart() {
  if (activeTab.value !== 'treemap') {
    destroyChart()
    return
  }

  await nextTick()

  if (!chartRef.value) {
    return
  }

  if (chartRef.value.clientWidth === 0 || chartRef.value.clientHeight === 0) {
    window.requestAnimationFrame(() => {
      void ensureChart()
    })
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
  moreMenuOpen.value = false
}

async function copyPrReport() {
  await navigator.clipboard.writeText(exportPrMarkdownText.value)
  exportStatus.value = 'PR 摘要已复制'
  moreMenuOpen.value = false
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
  moreMenuOpen.value = false
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
  moreMenuOpen.value = false
}

function exportCsv() {
  const blob = new Blob([`${exportCsvText.value}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-analyze.csv'
  anchor.click()
  URL.revokeObjectURL(url)
  exportStatus.value = '已导出 CSV'
  moreMenuOpen.value = false
}

function handlePageClick() {
  moreMenuOpen.value = false
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    moreMenuOpen.value = false
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (resultRef.value) {
      commandPaletteOpen.value = true
    }
  }
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
  selectedActionKey.value = null
})

watch(resolvedTheme, async () => {
  if (chart && chartRef.value) {
    destroyChart()
  }
  await ensureChart()
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('click', handlePageClick)
  void ensureChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('click', handlePageClick)
  destroyChart()
})
</script>

<template>
  <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
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

    <section class="relative z-20 flex min-w-0 items-center gap-3 overflow-visible rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2 shadow-(--dashboard-shadow)">
      <nav class="flex shrink-0 flex-nowrap gap-2">
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
      <div class="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
        <button
          v-if="resultRef"
          class="shrink-0"
          :class="pillButtonStyles({ kind: 'nav', active: false })"
          @click="commandPaletteOpen = true"
        >
          <span class="h-4.5 w-4.5">
            <DashboardIcon name="metric-search" />
          </span>
          搜索
        </button>
        <AppInfoPill
          v-if="exportStatus"
          class="shrink-0"
          :label="exportStatus"
          uppercase
        />
        <AppInfoPill
          v-for="item in statusPills"
          :key="item.label"
          class="shrink-0"
          v-bind="item"
          uppercase
        />
      </div>
      <div
        v-if="resultRef"
        class="relative shrink-0"
        @click.stop
      >
        <button
          :class="pillButtonStyles({ kind: 'nav', active: moreMenuOpen })"
          type="button"
          @click="moreMenuOpen = !moreMenuOpen"
        >
          <span class="h-4.5 w-4.5">
            <DashboardIcon name="nav-menu" />
          </span>
          更多
        </button>
        <div
          v-if="moreMenuOpen"
          class="absolute right-0 top-[calc(100%+0.45rem)] z-50 w-48 overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-1.5 shadow-(--dashboard-shadow)"
        >
          <button
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-(--dashboard-text) transition hover:bg-(--dashboard-panel-muted)"
            type="button"
            @click="copySummary"
          >
            <span class="h-4.5 w-4.5 text-(--dashboard-text-soft)">
              <DashboardIcon name="metric-copy" />
            </span>
            复制摘要
          </button>
          <button
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-(--dashboard-text) transition hover:bg-(--dashboard-panel-muted)"
            type="button"
            @click="copyPrReport"
          >
            <span class="h-4.5 w-4.5 text-(--dashboard-text-soft)">
              <DashboardIcon name="metric-copy" />
            </span>
            复制 PR
          </button>
          <button
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-(--dashboard-text) transition hover:bg-(--dashboard-panel-muted)"
            type="button"
            @click="exportJson"
          >
            <span class="h-4.5 w-4.5 text-(--dashboard-text-soft)">
              <DashboardIcon name="metric-size-outline" />
            </span>
            导出 JSON
          </button>
          <button
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-(--dashboard-text) transition hover:bg-(--dashboard-panel-muted)"
            type="button"
            @click="exportMarkdown"
          >
            <span class="h-4.5 w-4.5 text-(--dashboard-text-soft)">
              <DashboardIcon name="file-samples" />
            </span>
            导出 MD
          </button>
          <button
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-(--dashboard-text) transition hover:bg-(--dashboard-panel-muted)"
            type="button"
            @click="exportCsv"
          >
            <span class="h-4.5 w-4.5 text-(--dashboard-text-soft)">
              <DashboardIcon name="file-samples" />
            </span>
            导出 CSV
          </button>
        </div>
      </div>
    </section>

    <template v-if="resultRef">
      <section v-if="activeTab === 'overview'" class="min-h-0 overflow-hidden">
        <AnalyzeDraggableGrid
          grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
          :items="overviewLayoutItems"
          storage-key="weapp-vite:dashboard:analyze-layout:overview"
        >
          <template #metrics>
            <AnalyzeOverviewPanel
              :action-items="actionItems"
              :cards="topCards"
              :largest-files="largestFiles"
              :package-insights="packageInsights"
              :package-type-summary="metricPackageTypeSummary"
              @copy-report="copyPrReport"
              @select-action="handleSelectAction"
              @select-file="handleSelectLargestFile"
              @select-package="handleSelectPackageInsight"
            />
          </template>
        </AnalyzeDraggableGrid>
      </section>

      <section v-else-if="activeTab === 'diagnostics'" class="min-h-0 overflow-hidden">
        <AnalyzeDraggableGrid
          grid-class="grid h-full min-h-0 gap-2 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)]"
          :items="diagnosticsLayoutItems"
          storage-key="weapp-vite:dashboard:analyze-layout:diagnostics"
        >
          <template #actions>
            <ActionCenterPanel
              :actions="actionItems"
              :active-key="selectedActionKey"
              @copy-report="copyPrReport"
              @select="handleSelectAction"
            />
          </template>
          <template #history>
            <HistoryBaselinePanel
              :snapshots="historySnapshots"
              :baseline-snapshot-id="baselineSnapshotId"
              :comparison-mode="comparisonMode"
              @set-baseline="setBaselineSnapshot"
              @set-comparison-mode="setComparisonMode"
            />
          </template>
        </AnalyzeDraggableGrid>
      </section>

      <section v-else-if="activeTab === 'treemap'" class="min-h-0 overflow-hidden">
        <AnalyzeDraggableGrid
          grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
          :items="treemapLayoutItems"
          storage-key="weapp-vite:dashboard:analyze-layout:treemap"
        >
          <template #treemap>
            <TreemapCard
              :bind-chart-ref="bindChartRef"
              :can-focus-selected="Boolean(selectedTreemapFocusNodeId)"
              :filter-mode="treemapFilterMode"
              :filter-options="treemapFilterOptions"
              :can-use-selected-package-filter="canUseSelectedPackageFilter"
              :is-empty="isTreemapEmpty"
              @focus-selected="handleFocusTreemapSelection"
              @reset-focus="handleResetTreemapFocus"
              @update-filter-mode="handleUpdateTreemapFilterMode"
            />
          </template>
        </AnalyzeDraggableGrid>
      </section>

      <section v-else-if="activeTab === 'files'" class="min-h-0 overflow-hidden">
        <AnalyzeDetailsPanel
          :visible-largest-files="visibleLargestFiles"
          :selected-file-modules="selectedFileModules"
          :budget-warnings="budgetWarnings"
          :budget-limit-items="budgetLimitItems"
          :active-budget-warning-id="selectedBudgetWarning?.id ?? null"
          :active-largest-file-key="activeLargestFileKey"
          :selected-treemap-meta="selectedTreemapMeta"
          @select-budget-warning="handleSelectBudgetWarning"
          @select-file="handleSelectLargestFile"
        />
      </section>

      <section v-else-if="activeTab === 'packages'" class="min-h-0 overflow-hidden">
        <AnalyzeDraggableGrid
          grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
          :items="packagesLayoutItems"
          storage-key="weapp-vite:dashboard:analyze-layout:packages"
        >
          <template #packages>
            <PackagesPanel
              :package-insights="packageInsights"
              :budget-warnings="budgetWarnings"
              :selected-treemap-meta="selectedTreemapMeta"
            />
          </template>
        </AnalyzeDraggableGrid>
      </section>

      <section v-else class="min-h-0 overflow-hidden">
        <AnalyzeDraggableGrid
          grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
          :items="modulesLayoutItems"
          storage-key="weapp-vite:dashboard:analyze-layout:modules"
        >
          <template #modules>
            <ModulesPanel
              :duplicate-modules="filteredDuplicateModules"
              :module-source-summary="moduleSourceSummary"
              :increment-attribution="incrementAttribution"
              :increment-summary="incrementSummary"
              :visible-largest-files="visibleLargestFiles"
            />
          </template>
        </AnalyzeDraggableGrid>
      </section>
    </template>

    <AnalyzeCommandPalette
      :open="Boolean(resultRef && commandPaletteOpen)"
      :items="commandItems"
      @close="commandPaletteOpen = false"
      @select="handleSelectCommand"
    />
  </div>
</template>
