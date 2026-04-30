<script setup lang="ts">
import type {
  DashboardDetailItem,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  IncrementAttributionSummary,
  LargestFileEntry,
  ModuleSourceSummary,
  ModuleSourceType,
} from '../types'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBuildOrigin, formatBytes } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import AppSummaryValueCard from './AppSummaryValueCard.vue'
import DuplicateModulesToolbar from './DuplicateModulesToolbar.vue'
import ModuleInsightsSidebar from './ModuleInsightsSidebar.vue'

type DuplicateModuleSourceFilter = 'all' | ModuleSourceType
type DuplicateModuleSortMode = 'saving' | 'packages' | 'size' | 'source'

interface DuplicateModuleItem extends DashboardDetailItem {
  key: string
  packages: DuplicateModuleEntry['packages']
}

interface ListItemRow extends DashboardDetailItem {
  key: string
}

const props = defineProps<{
  duplicateModules: DuplicateModuleEntry[]
  moduleSourceSummary: ModuleSourceSummary[]
  incrementAttribution: IncrementAttributionEntry[]
  incrementSummary: IncrementAttributionSummary[]
  visibleLargestFiles: LargestFileEntry[]
}>()

const duplicateQuery = ref('')
const duplicateSourceFilter = ref<DuplicateModuleSourceFilter>('all')
const duplicateSortMode = ref<DuplicateModuleSortMode>('saving')
const actionStatus = ref('')
let actionStatusTimer: ReturnType<typeof setTimeout> | null = null

function createDuplicateModuleItem(module: DuplicateModuleEntry): DashboardDetailItem {
  return {
    title: module.source,
    meta: `${module.packageCount} 个包 · 单份 ${formatBytes(module.bytes)} · 可节省 ${formatBytes(module.estimatedSavingBytes)} · ${module.advice}`,
  }
}

function createModuleSourceItem(item: ModuleSourceSummary): DashboardDetailItem {
  return {
    title: item.sourceCategory,
    meta: `${item.count} 个模块`,
    value: formatBytes(item.bytes),
  }
}

function createIncrementItem(item: IncrementAttributionEntry): DashboardDetailItem {
  return {
    title: item.label,
    meta: `${item.category} · ${item.packageLabel} · ${item.advice}`,
    value: `+${formatBytes(item.deltaBytes)}`,
  }
}

function createIncrementSummaryItem(item: IncrementAttributionSummary): DashboardDetailItem {
  return {
    title: item.category,
    meta: `${item.count} 项增长`,
    value: `+${formatBytes(item.deltaBytes)}`,
  }
}

function createLargestFileSampleItem(file: LargestFileEntry): DashboardDetailItem {
  return {
    title: file.file,
    meta: `${file.packageLabel} · ${formatBuildOrigin(file.from)} · ${file.moduleCount} 模块`,
  }
}

function escapeMarkdownCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

const duplicateSourceOptions = computed(() => {
  const sourceSet = new Set<ModuleSourceType>()
  for (const module of props.duplicateModules) {
    sourceSet.add(module.sourceType)
  }
  return [...sourceSet].sort((a, b) => a.localeCompare(b))
})

const filteredDuplicateModules = computed(() => {
  const keyword = duplicateQuery.value.trim().toLowerCase()
  return props.duplicateModules
    .filter((module) => {
      if (duplicateSourceFilter.value !== 'all' && module.sourceType !== duplicateSourceFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        module.id,
        module.source,
        module.sourceType,
        module.advice,
        module.packages.map(pkg => pkg.packageLabel).join(' '),
        module.packages.flatMap(pkg => pkg.files).join(' '),
      ].some(value => value.toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (duplicateSortMode.value === 'packages') {
        return b.packageCount - a.packageCount || b.estimatedSavingBytes - a.estimatedSavingBytes || a.source.localeCompare(b.source)
      }
      if (duplicateSortMode.value === 'size') {
        return b.bytes - a.bytes || b.packageCount - a.packageCount || a.source.localeCompare(b.source)
      }
      if (duplicateSortMode.value === 'source') {
        return a.source.localeCompare(b.source)
      }
      return b.estimatedSavingBytes - a.estimatedSavingBytes || b.packageCount - a.packageCount || a.source.localeCompare(b.source)
    })
})

const duplicateModuleItems = computed<DuplicateModuleItem[]>(() => filteredDuplicateModules.value.map(module => ({
  key: module.id,
  packages: module.packages,
  ...createDuplicateModuleItem(module),
})))

const moduleSourceItems = computed<ListItemRow[]>(() => props.moduleSourceSummary.map(item => ({
  key: `${item.sourceType}:${item.sourceCategory}`,
  ...createModuleSourceItem(item),
})))

const incrementItems = computed<ListItemRow[]>(() => props.incrementAttribution.slice(0, 8).map(item => ({
  key: item.key,
  ...createIncrementItem(item),
})))

const incrementSummaryItems = computed<ListItemRow[]>(() => props.incrementSummary.slice(0, 6).map(item => ({
  key: item.category,
  ...createIncrementSummaryItem(item),
})))

const largestFileSampleItems = computed<ListItemRow[]>(() => props.visibleLargestFiles.slice(0, 6).map(file => ({
  key: `${file.packageId}:${file.file}`,
  ...createLargestFileSampleItem(file),
})))

const duplicateModulesReportText = computed(() => [
  '# dashboard 重复模块',
  '',
  `模块数量：${filteredDuplicateModules.value.length} / ${props.duplicateModules.length}`,
  '',
  '| 模块 | 来源 | 包数量 | 单份体积 | 可节省 | 建议 | 涉及包 |',
  '| --- | --- | ---: | ---: | ---: | --- | --- |',
  ...filteredDuplicateModules.value.map(module => [
    module.source,
    module.sourceType,
    String(module.packageCount),
    formatBytes(module.bytes),
    formatBytes(module.estimatedSavingBytes),
    module.advice,
    module.packages.map(pkg => pkg.packageLabel).join(', '),
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

async function copyDuplicateModulesReport() {
  try {
    await copyText(duplicateModulesReportText.value)
    setActionStatus('已复制')
  }
  catch {
    setActionStatus('复制失败')
  }
}

function exportDuplicateModulesJson() {
  const blob = new Blob([`${JSON.stringify(filteredDuplicateModules.value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-dashboard-duplicate-modules.json'
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
  <section class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.76fr)]">
    <div :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <AppPanelHeader
          icon-name="duplicate-modules"
          title="重复模块"
          :description="`${duplicateModules.length} 个重复模块样本`"
        />
        <DuplicateModulesToolbar
          v-model:query="duplicateQuery"
          v-model:sort-mode="duplicateSortMode"
          v-model:source-filter="duplicateSourceFilter"
          :action-status="actionStatus"
          :disabled="duplicateModuleItems.length === 0"
          :filtered-count="duplicateModuleItems.length"
          :source-options="duplicateSourceOptions"
          :total-count="duplicateModules.length"
          @copy="copyDuplicateModulesReport"
          @export-json="exportDuplicateModulesJson"
        />
      </div>

      <div v-if="duplicateModuleItems.length" class="mt-4 max-h-[calc(100%-5.75rem)] space-y-2.5 overflow-y-auto pr-1">
        <AppSummaryValueCard
          v-for="item in duplicateModuleItems"
          :key="item.key"
          break-title
          :meta="item.meta"
          :title="item.title"
          :value="item.value"
        >
          <ul class="mt-3 space-y-1.5 text-xs text-(--dashboard-text-muted)">
            <li v-for="pkg in item.packages" :key="`${item.key}:${pkg.packageId}`">
              <span class="font-medium text-(--dashboard-text)">{{ pkg.packageLabel }}</span>
              <span class="text-(--dashboard-text-soft)"> · </span>
              <span>{{ pkg.files.join('、') }}</span>
            </li>
          </ul>
        </AppSummaryValueCard>
      </div>
      <AppEmptyState v-else class="mt-4">
        当前构建未检测到跨包重复模块。
      </AppEmptyState>
    </div>

    <ModuleInsightsSidebar
      :increment-items="incrementItems"
      :increment-summary-items="incrementSummaryItems"
      :largest-file-sample-items="largestFileSampleItems"
      :module-source-items="moduleSourceItems"
    />
  </section>
</template>
