<script setup lang="ts">
import type { DashboardMetricCard, SummaryMetric } from '../types'
import { computed } from 'vue'
import { formatPackageType } from '../utils/format'
import { iconFrameStyles, surfaceStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  cards: DashboardMetricCard[]
  packageTypeSummary: SummaryMetric[]
  compact?: boolean
}>()

interface MetricSummaryTag {
  label: string
  value: string
}

interface DashboardMetricCardRow extends DashboardMetricCard {
  packageTypeTags: MetricSummaryTag[]
}

function getMetricCardClassName(card: DashboardMetricCard): string[] {
  return [
    surfaceStyles({ padding: props.compact ? 'sm' : 'md' }),
    'min-w-0',
    card.wide ? 'xl:col-span-2' : 'xl:col-span-1',
  ]
}

const metricCardRows = computed<DashboardMetricCardRow[]>(() => props.cards.map(card => ({
  ...card,
  packageTypeTags: card.label === '总产物体积'
    ? props.packageTypeSummary.map(item => ({
        label: formatPackageType(item.label),
        value: String(item.value),
      }))
    : [],
})))
</script>

<template>
  <section :class="compact ? 'grid min-h-0 items-start gap-2 md:grid-cols-3 xl:grid-cols-6' : 'grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-6'">
    <article
      v-for="card in metricCardRows"
      :key="card.label"
      :class="getMetricCardClassName(card)"
    >
      <div :class="compact ? 'relative h-full min-w-0 pr-8' : 'flex h-full min-w-0 items-start justify-between gap-2'">
        <div class="min-w-0">
          <p :class="compact ? 'whitespace-nowrap text-[11px] leading-4 text-(--dashboard-text-soft)' : 'text-[11px] uppercase tracking-[0.22em] text-(--dashboard-text-soft)'">
            {{ card.label }}
          </p>
          <p :class="compact ? 'mt-1 text-xl font-semibold leading-6' : 'mt-2 text-2xl font-semibold md:text-[1.65rem]'">
            {{ card.value }}
          </p>
          <p v-if="card.detail" class="mt-1 text-xs font-medium text-(--dashboard-accent)">
            {{ card.detail }}
          </p>
        </div>
        <span :class="[iconFrameStyles({ size: compact ? 'sm' : 'lg' }), compact ? 'absolute right-0 top-0' : undefined]">
          <span :class="compact ? 'h-4.5 w-4.5' : 'h-5 w-5'">
            <DashboardIcon :name="card.iconName" />
          </span>
        </span>
      </div>
      <div v-if="card.packageTypeTags.length > 0 && !compact" class="mt-3 flex flex-wrap gap-1.5">
        <span
          v-for="item in card.packageTypeTags"
          :key="item.label"
          class="rounded-full border border-(--dashboard-border-strong) bg-(--dashboard-accent-soft) px-3 py-1 text-xs text-(--dashboard-text)"
        >
          {{ item.label }} {{ item.value }}
        </span>
      </div>
    </article>
  </section>
</template>
