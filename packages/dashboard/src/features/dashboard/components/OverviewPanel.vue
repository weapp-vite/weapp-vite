<script setup lang="ts">
import type { DashboardDetailItem, LargestFileEntry, SubPackageDescriptor } from '../types'
import { computed } from 'vue'
import { formatBytes, formatPackageType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import TreemapCard from './TreemapCard.vue'

const props = defineProps<{
  bindChartRef: (element: Element | null) => void
  visibleLargestFiles: LargestFileEntry[]
  subPackages: SubPackageDescriptor[]
}>()

function createLargestFileItem(file: LargestFileEntry): DashboardDetailItem {
  return {
    title: file.file,
    meta: `${file.packageLabel} · ${formatPackageType(file.packageType)} · ${file.type}`,
    value: formatBytes(file.size),
  }
}

function createSubPackageItem(pkg: SubPackageDescriptor): DashboardDetailItem {
  return {
    title: pkg.root,
    meta: `${pkg.name ? `别名 ${pkg.name}` : '未设置别名'} · ${pkg.independent ? '独立分包' : '普通分包'}`,
  }
}

const largestFileItems = computed(() => props.visibleLargestFiles.map(file => ({
  key: `${file.packageId}:${file.file}`,
  ...createLargestFileItem(file),
})))

const subPackageItems = computed(() => props.subPackages.map(pkg => ({
  key: pkg.root,
  ...createSubPackageItem(pkg),
})))

const hasSubPackageItems = computed(() => subPackageItems.value.length > 0)
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.75fr)] xl:items-stretch">
    <TreemapCard :bind-chart-ref="bindChartRef" />

    <div class="grid gap-3 xl:h-[min(58vh,36rem)] xl:grid-rows-[minmax(0,1fr)_minmax(0,0.82fr)]">
      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="top-files"
          title="Top Files"
          description="最大体积样本"
        >
          <template #meta>
            <span class="text-[11px] uppercase tracking-[0.2em] text-[color:var(--dashboard-text-soft)]">Top 10</span>
          </template>
        </AppPanelHeader>
        <ol class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm xl:grid-cols-1">
          <AppCompactListItem
            v-for="item in largestFileItems"
            :key="item.key"
            v-bind="item"
          />
        </ol>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="subpackages"
          title="Subpackages"
          description="分包根目录与模式"
        >
          <template #meta>
            <span class="text-[11px] uppercase tracking-[0.2em] text-[color:var(--dashboard-text-soft)]">Roots</span>
          </template>
        </AppPanelHeader>
        <ul class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-[color:var(--dashboard-text-muted)]">
          <AppEmptyState v-if="!hasSubPackageItems" as="li" compact>
            当前构建没有配置分包。
          </AppEmptyState>
          <AppCompactListItem
            v-for="item in subPackageItems"
            :key="item.key"
            v-bind="item"
          />
        </ul>
      </section>
    </div>
  </section>
</template>
