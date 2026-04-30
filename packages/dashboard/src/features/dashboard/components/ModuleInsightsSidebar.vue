<script setup lang="ts">
import type { DashboardDetailItem } from '../types'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import AppSummaryValueCard from './AppSummaryValueCard.vue'

type InsightListItem = DashboardDetailItem & { key: string }

defineProps<{
  incrementItems: InsightListItem[]
  incrementSummaryItems: InsightListItem[]
  moduleSourceItems: InsightListItem[]
  largestFileSampleItems: InsightListItem[]
}>()
</script>

<template>
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
</template>
