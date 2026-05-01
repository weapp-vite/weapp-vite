<script setup lang="ts">
import type { DashboardDetailItem } from '../types'
import type { ModuleOptimizationPlanItem, ModuleOptimizationPlanSummary } from '../utils/moduleOptimizationPlan'
import { onBeforeUnmount, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppMetricTile from './AppMetricTile.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import AppSummaryValueCard from './AppSummaryValueCard.vue'

type InsightListItem = DashboardDetailItem & { key: string }

const props = defineProps<{
  incrementItems: InsightListItem[]
  incrementSummaryItems: InsightListItem[]
  moduleSourceItems: InsightListItem[]
  largestFileSampleItems: InsightListItem[]
  optimizationPlan: ModuleOptimizationPlanSummary
}>()

const optimizationPlanStatus = ref('')
let optimizationPlanStatusTimer: ReturnType<typeof setTimeout> | null = null

function getEffortLabel(effort: ModuleOptimizationPlanItem['effort']) {
  if (effort === 'high') {
    return '高成本'
  }
  if (effort === 'medium') {
    return '中成本'
  }
  return '低成本'
}

function getEffortClassName(effort: ModuleOptimizationPlanItem['effort']) {
  if (effort === 'high') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
  }
  if (effort === 'medium') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
}

function setOptimizationPlanStatus(status: string) {
  optimizationPlanStatus.value = status
  if (optimizationPlanStatusTimer) {
    clearTimeout(optimizationPlanStatusTimer)
  }
  optimizationPlanStatusTimer = setTimeout(() => {
    optimizationPlanStatus.value = ''
    optimizationPlanStatusTimer = null
  }, 1800)
}

async function copyOptimizationPlan() {
  try {
    await copyText(props.optimizationPlan.report)
    setOptimizationPlanStatus('计划已复制')
  }
  catch {
    setOptimizationPlanStatus('复制失败')
  }
}

onBeforeUnmount(() => {
  if (optimizationPlanStatusTimer) {
    clearTimeout(optimizationPlanStatusTimer)
  }
})
</script>

<template>
  <div class="grid min-h-0 gap-3 overflow-hidden xl:grid-rows-[auto_minmax(0,1fr)_minmax(0,0.8fr)]">
    <section :class="surfaceStyles({ padding: 'md' })" class="overflow-hidden">
      <AppPanelHeader icon-name="metric-quality" title="优化计划">
        <template #meta>
          <div class="flex items-center gap-2">
            <span v-if="optimizationPlanStatus" class="text-xs font-medium text-(--dashboard-accent)">
              {{ optimizationPlanStatus }}
            </span>
            <button
              type="button"
              class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-xs text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) disabled:opacity-50"
              :disabled="optimizationPlan.items.length === 0"
              @click="copyOptimizationPlan"
            >
              复制计划
            </button>
          </div>
        </template>
      </AppPanelHeader>

      <div class="mt-3 grid grid-cols-3 gap-2">
        <AppMetricTile label="计划项" :value="optimizationPlan.items.length" />
        <AppMetricTile label="估算影响" :value="formatBytes(optimizationPlan.totalImpactBytes)" />
        <AppMetricTile label="低成本项" :value="optimizationPlan.quickWinCount" />
      </div>

      <div v-if="optimizationPlan.items.length" class="mt-3 grid max-h-54 gap-2 overflow-y-auto pr-1">
        <article
          v-for="item in optimizationPlan.items"
          :key="item.id"
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="min-w-0 text-sm font-medium text-(--dashboard-text)">
              {{ item.title }}
            </p>
            <span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px]" :class="getEffortClassName(item.effort)">
              {{ getEffortLabel(item.effort) }}
            </span>
          </div>
          <p class="mt-1 line-clamp-2 text-xs leading-5 text-(--dashboard-text-muted)">
            {{ item.detail }}
          </p>
          <p class="mt-2 text-xs text-(--dashboard-text-soft)">
            {{ item.action }} · 影响 {{ formatBytes(item.impactBytes) }}
          </p>
        </article>
      </div>
      <AppEmptyState v-else class="mt-3">
        当前没有需要生成的模块优化计划。
      </AppEmptyState>
    </section>

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
</template>
