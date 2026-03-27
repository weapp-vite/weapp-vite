<script setup lang="ts">
import type { LargestFileEntry } from '../composables/useAnalyzeDashboardData'
import type { SubPackageDescriptor } from '../types'
import { formatBytes, formatPackageType } from '../utils/format'
import { iconFrameStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import DashboardIcon from './DashboardIcon.vue'
import TreemapCard from './TreemapCard.vue'

defineProps<{
  bindChartRef: (element: Element | null) => void
  visibleLargestFiles: LargestFileEntry[]
  subPackages: SubPackageDescriptor[]
}>()
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.75fr)] xl:items-stretch">
    <TreemapCard :bind-chart-ref="bindChartRef" />

    <div class="grid gap-3 xl:h-[min(58vh,36rem)] xl:grid-rows-[minmax(0,1fr)_minmax(0,0.82fr)]">
      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span :class="iconFrameStyles()">
              <span class="h-5 w-5">
                <DashboardIcon name="top-files" />
              </span>
            </span>
            <div>
              <h2 class="text-lg font-semibold">
                Top Files
              </h2>
              <p class="text-xs text-[color:var(--dashboard-text-soft)]">
                最大体积样本
              </p>
            </div>
          </div>
          <span class="text-[11px] uppercase tracking-[0.2em] text-[color:var(--dashboard-text-soft)]">Top 10</span>
        </div>
        <ol class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm xl:grid-cols-1">
          <li
            v-for="file in visibleLargestFiles"
            :key="`${file.packageId}:${file.file}`"
            class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-3 py-2.5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium">
                  {{ file.file }}
                </p>
                <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
                  {{ file.packageLabel }} · {{ formatPackageType(file.packageType) }} · {{ file.type }}
                </p>
              </div>
              <span class="whitespace-nowrap font-medium text-[color:var(--dashboard-accent)]">{{ formatBytes(file.size) }}</span>
            </div>
          </li>
        </ol>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span :class="iconFrameStyles()">
              <span class="h-5 w-5">
                <DashboardIcon name="subpackages" />
              </span>
            </span>
            <div>
              <h2 class="text-lg font-semibold">
                Subpackages
              </h2>
              <p class="text-xs text-[color:var(--dashboard-text-soft)]">
                分包根目录与模式
              </p>
            </div>
          </div>
          <span class="text-[11px] uppercase tracking-[0.2em] text-[color:var(--dashboard-text-soft)]">Roots</span>
        </div>
        <ul class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-[color:var(--dashboard-text-muted)]">
          <AppEmptyState v-if="subPackages.length === 0" as="li" compact>
            当前构建没有配置分包。
          </AppEmptyState>
          <li
            v-for="pkg in subPackages"
            :key="pkg.root"
            class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-3 py-2.5"
          >
            <p class="font-medium">
              {{ pkg.root }}
            </p>
            <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
              {{ pkg.name ? `别名 ${pkg.name}` : '未设置别名' }} · {{ pkg.independent ? '独立分包' : '普通分包' }}
            </p>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
