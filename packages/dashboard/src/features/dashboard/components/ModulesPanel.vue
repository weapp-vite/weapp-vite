<script setup lang="ts">
import type {
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  IncrementAttributionSummary,
  LargestFileEntry,
  ModuleSourceSummary,
} from '../types'
import { useDuplicateModulesPanel } from '../composables/useDuplicateModulesPanel'
import { surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import AppSummaryValueCard from './AppSummaryValueCard.vue'
import DuplicateModulesToolbar from './DuplicateModulesToolbar.vue'
import ModuleInsightsSidebar from './ModuleInsightsSidebar.vue'

const props = defineProps<{
  duplicateModules: DuplicateModuleEntry[]
  moduleSourceSummary: ModuleSourceSummary[]
  incrementAttribution: IncrementAttributionEntry[]
  incrementSummary: IncrementAttributionSummary[]
  visibleLargestFiles: LargestFileEntry[]
}>()

const {
  actionStatus,
  copyDuplicateModulesReport,
  duplicateModuleItems,
  duplicateQuery,
  duplicateSortMode,
  duplicateSourceFilter,
  duplicateSourceOptions,
  exportDuplicateModulesJson,
  incrementItems,
  incrementSummaryItems,
  largestFileSampleItems,
  moduleOptimizationPlan,
  moduleSourceItems,
} = useDuplicateModulesPanel(props)
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
      :optimization-plan="moduleOptimizationPlan"
    />
  </section>
</template>
