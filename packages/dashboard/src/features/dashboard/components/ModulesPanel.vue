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
import { computed, ref } from 'vue'
import { formatBuildOrigin, formatBytes } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import AppSummaryValueCard from './AppSummaryValueCard.vue'

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

const duplicateSourceOptions = computed(() => {
  const sourceSet = new Set<ModuleSourceType>()
  for (const module of props.duplicateModules) {
    sourceSet.add(module.sourceType)
  }
  return [...sourceSet].sort((a, b) => a.localeCompare(b))
})

const duplicateModuleItems = computed<DuplicateModuleItem[]>(() => {
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
    .map(module => ({
      key: module.id,
      packages: module.packages,
      ...createDuplicateModuleItem(module),
    }))
})

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
</script>

<template>
  <section class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.76fr)]">
    <div :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <AppPanelHeader
          icon-name="duplicate-modules"
          title="重复模块"
          :description="`匹配 ${duplicateModuleItems.length} / ${duplicateModules.length} 个模块`"
        />
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="duplicateQuery"
            class="h-9 w-56 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text) outline-none transition placeholder:text-(--dashboard-text-soft) focus:border-(--dashboard-accent)"
            placeholder="搜索模块、包或文件"
            type="search"
          >
          <select
            v-model="duplicateSourceFilter"
            class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
          >
            <option value="all">
              全部来源
            </option>
            <option
              v-for="sourceType in duplicateSourceOptions"
              :key="sourceType"
              :value="sourceType"
            >
              {{ sourceType }}
            </option>
          </select>
          <select
            v-model="duplicateSortMode"
            class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
          >
            <option value="saving">
              按可节省
            </option>
            <option value="packages">
              按包数量
            </option>
            <option value="size">
              按单份体积
            </option>
            <option value="source">
              按路径
            </option>
          </select>
        </div>
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

    <div class="grid min-h-0 gap-3 overflow-hidden xl:grid-rows-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader icon-name="metric-time" title="增量归因" />
        <div v-if="incrementItems.length" class="mt-4 grid h-[calc(100%-3.5rem)] min-h-0 gap-3 overflow-hidden lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)]">
          <div class="space-y-2 overflow-y-auto pr-1">
            <AppSummaryValueCard
              v-for="item in incrementSummaryItems"
              :key="item.key"
              :meta="item.meta"
              :title="item.title"
              :value="item.value"
            />
          </div>
          <ul class="space-y-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
            <AppCompactListItem
              v-for="item in incrementItems"
              :key="item.key"
              :meta="item.meta"
              mono-title
              :title="item.title"
              :value="item.value"
            />
          </ul>
        </div>
        <AppEmptyState v-else class="mt-4">
          暂无可对比的正向增量。
        </AppEmptyState>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader icon-name="module-sources" title="模块来源" />
        <div class="mt-4 grid h-[calc(100%-3.5rem)] min-h-0 gap-3 overflow-hidden lg:grid-cols-2">
          <div class="space-y-2.5 overflow-y-auto pr-1">
            <AppSummaryValueCard
              v-for="item in moduleSourceItems"
              :key="item.key"
              :meta="item.meta"
              :title="item.title"
              :value="item.value"
            />
          </div>
          <ul class="space-y-2.5 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
            <AppCompactListItem
              v-for="item in largestFileSampleItems"
              :key="item.key"
              :meta="item.meta"
              mono-title
              :title="item.title"
              :value="item.value"
            />
          </ul>
        </div>
      </section>
    </div>
  </section>
</template>
