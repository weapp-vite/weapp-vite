<script setup lang="ts">
import type { DashboardMetricCard, SummaryMetric } from '../types'
import { computed } from 'vue'
import { formatPackageType } from '../utils/format'
import { iconFrameStyles, surfaceStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  cards: DashboardMetricCard[]
  packageTypeSummary: SummaryMetric[]
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
    surfaceStyles({ padding: 'md' }),
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
  <section class="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
    <article
      v-for="card in metricCardRows"
      :key="card.label"
      :class="getMetricCardClassName(card)"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] uppercase tracking-[0.22em] text-[color:var(--dashboard-text-soft)]">
            {{ card.label }}
          </p>
          <p class="mt-2 text-2xl font-semibold md:text-[1.65rem]">
            {{ card.value }}
          </p>
        </div>
        <span :class="iconFrameStyles({ size: 'lg' })">
          <span class="h-5 w-5">
            <DashboardIcon :name="card.iconName" />
          </span>
        </span>
      </div>
      <div v-if="card.packageTypeTags.length > 0" class="mt-3 flex flex-wrap gap-1.5">
        <span
          v-for="item in card.packageTypeTags"
          :key="item.label"
          class="rounded-full border border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-accent-soft)] px-3 py-1 text-xs text-[color:var(--dashboard-text)]"
        >
          {{ item.label }} {{ item.value }}
        </span>
      </div>
    </article>
  </section>
</template>
