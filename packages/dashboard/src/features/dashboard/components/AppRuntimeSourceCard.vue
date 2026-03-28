<script setup lang="ts">
import type { DashboardRuntimeBadgeItem, DashboardRuntimeSourceCardItem } from '../types'
import { computed } from 'vue'
import { getRuntimeSourceBadgeTone } from '../utils/format'
import { mutedPanelStyles } from '../utils/styles'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

interface RuntimeSourceDetailItem {
  key: string
  label: string
}

const props = defineProps<{
  source: DashboardRuntimeSourceCardItem['source']
  count: DashboardRuntimeSourceCardItem['count']
  errorCount: DashboardRuntimeSourceCardItem['errorCount']
  averageDuration: DashboardRuntimeSourceCardItem['averageDuration']
  latestTimestamp?: DashboardRuntimeSourceCardItem['latestTimestamp']
  countLabel?: string
}>()

function createRuntimeSourceBadge(): DashboardRuntimeBadgeItem {
  return {
    label: props.latestTimestamp ? `${props.count} 条` : `错误 ${props.errorCount}`,
    tone: getRuntimeSourceBadgeTone(props.errorCount),
  }
}

const badge = computed<DashboardRuntimeBadgeItem>(() => createRuntimeSourceBadge())

const subtitle = computed(() =>
  props.latestTimestamp
    ? `最近事件 ${props.latestTimestamp}`
    : `${props.count} ${props.countLabel ?? '条事件'}`,
)

const detailItems = computed<RuntimeSourceDetailItem[]>(() => [
  {
    key: 'error-count',
    label: `错误 ${props.errorCount}`,
  },
  {
    key: 'average-duration',
    label: `平均耗时 ${props.averageDuration}`,
  },
])

const summaryText = computed(() => `平均耗时 ${props.averageDuration}`)
</script>

<template>
  <div :class="mutedPanelStyles({ padding: 'sm' })">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate font-medium text-[color:var(--dashboard-text)]">
          {{ props.source }}
        </p>
        <p class="mt-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--dashboard-text-soft)]">
          {{ subtitle }}
        </p>
      </div>
      <AppRuntimeBadge v-bind="badge" />
    </div>
    <div
      v-if="props.latestTimestamp"
      class="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-[color:var(--dashboard-text-soft)]"
    >
      <span
        v-for="item in detailItems"
        :key="item.key"
        class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5"
      >
        {{ item.label }}
      </span>
    </div>
    <p v-else class="mt-3 text-sm text-[color:var(--dashboard-text-muted)]">
      {{ summaryText }}
    </p>
  </div>
</template>
