<script setup lang="ts">
import type { PackageBudgetWarning, PackageInsight, TreemapNodeMeta } from '../types'
import { usePackageExplorerPanel } from '../composables/usePackageExplorerPanel'
import { surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppMetricTile from './AppMetricTile.vue'
import AppPackageFileTable from './AppPackageFileTable.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import PackageExplorerToolbar from './PackageExplorerToolbar.vue'
import PackageHealthPanel from './PackageHealthPanel.vue'

const props = defineProps<{
  packageInsights: PackageInsight[]
  budgetWarnings: PackageBudgetWarning[]
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const {
  actionStatus,
  copyPackageReport,
  exportPackageJson,
  filteredPackageInsightCards,
  packageBudgetFilter,
  packageHealth,
  packageInsightCards,
  packageQuery,
  packageSortMode,
  packageTypeFilter,
  packageTypeOptions,
} = usePackageExplorerPanel(props)
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
    <div class="grid gap-3">
      <PackageHealthPanel :health="packageHealth" />

      <div :class="surfaceStyles({ padding: 'md' })" class="grid gap-3">
        <AppPanelHeader
          icon-name="tab-packages"
          title="包体探索"
          :description="`${packageInsightCards.length} 个包体样本`"
        />
        <PackageExplorerToolbar
          v-model:budget-filter="packageBudgetFilter"
          v-model:query="packageQuery"
          v-model:sort-mode="packageSortMode"
          v-model:type-filter="packageTypeFilter"
          :action-status="actionStatus"
          :disabled="filteredPackageInsightCards.length === 0"
          :filtered-count="filteredPackageInsightCards.length"
          :total-count="packageInsightCards.length"
          :type-options="packageTypeOptions"
          @copy="copyPackageReport"
          @export-json="exportPackageJson"
        />
      </div>
    </div>

    <div class="grid min-h-0 auto-rows-max gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
      <AppEmptyState v-if="filteredPackageInsightCards.length === 0" class="xl:col-span-2">
        没有匹配当前筛选条件的包。
      </AppEmptyState>

      <article
        v-for="pkg in filteredPackageInsightCards"
        :key="pkg.id"
        :class="[
          surfaceStyles({ padding: 'md' }),
          pkg.selected ? 'border-(--dashboard-accent)' : '',
        ]"
        class="border transition"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <AppPanelHeader
              icon-name="tab-packages"
              :title="pkg.label"
              :description="pkg.typeLabel"
            />
            <p class="mt-2 text-sm text-(--dashboard-text-soft)">
              {{ pkg.summaryText }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-xl font-semibold text-(--dashboard-text)">
              {{ pkg.totalBytesLabel }}
            </p>
            <p class="text-xs text-(--dashboard-text-soft)">
              {{ pkg.compressedBytesLabel }}
            </p>
            <p class="mt-1 text-xs text-(--dashboard-accent)">
              {{ pkg.budgetText }}
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <AppMetricTile
            v-for="metric in pkg.metrics"
            :key="metric.label"
            v-bind="metric"
          />
        </div>

        <div class="mt-4">
          <AppPackageFileTable :files="pkg.topFiles" />
        </div>
      </article>
    </div>
  </section>
</template>
