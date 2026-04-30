<script setup lang="ts">
import type { DashboardMetricItem, PackageInsight } from '../types'
import { computed } from 'vue'
import { formatBytes, formatPackageType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppMetricTile from './AppMetricTile.vue'
import AppPackageFileTable from './AppPackageFileTable.vue'
import AppPanelHeader from './AppPanelHeader.vue'

interface PackageInsightCard extends PackageInsight {
  typeLabel: string
  summaryText: string
  totalBytesLabel: string
  entryCountText: string
  metrics: DashboardMetricItem[]
}

const props = defineProps<{
  packageInsights: PackageInsight[]
}>()

function createPackageMetrics(pkg: PackageInsight): DashboardMetricItem[] {
  return [
    { label: 'Chunks', value: pkg.chunkCount },
    { label: 'Assets', value: pkg.assetCount },
    { label: '模块数', value: pkg.moduleCount },
    { label: '跨包模块', value: pkg.duplicateModuleCount },
  ]
}

const packageInsightCards = computed<PackageInsightCard[]>(() => props.packageInsights.map((pkg) => {
  const typeLabel = formatPackageType(pkg.type)

  return {
    ...pkg,
    typeLabel,
    summaryText: `${typeLabel} · ${pkg.fileCount} 个产物 · ${pkg.moduleCount} 个模块`,
    totalBytesLabel: formatBytes(pkg.totalBytes),
    entryCountText: `${pkg.entryFileCount} 个 entry`,
    metrics: createPackageMetrics(pkg),
  }
}))
</script>

<template>
  <section class="h-full min-h-0 overflow-hidden">
    <div class="grid h-full min-h-0 gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
      <article
        v-for="pkg in packageInsightCards"
        :key="pkg.id"
        :class="surfaceStyles({ padding: 'md' })"
        class="min-h-0"
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
              {{ pkg.entryCountText }}
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
