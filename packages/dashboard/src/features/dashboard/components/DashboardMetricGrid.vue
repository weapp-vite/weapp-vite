<script setup lang="ts">
import type { DashboardMetricCard, SummaryMetric } from '../types'
import { computed } from 'vue'
import { formatPackageType } from '../utils/format'

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
  <section class="grid min-w-0 sm:grid-cols-2 xl:grid-cols-3" :class="compact ? 'gap-4' : 'gap-6'">
    <article
      v-for="card in metricCardRows"
      :key="card.label"
      class="min-w-0"
      :class="card.wide ? 'sm:col-span-2 xl:col-span-1' : undefined"
    >
      <p class="text-sm leading-6 text-(--dashboard-text-soft)">
        {{ card.label }}
      </p>
      <p class="mt-1 break-words text-xl font-semibold leading-7 tabular-nums text-(--dashboard-text)">
        {{ card.value }}
      </p>
      <p v-if="card.detail" class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
        {{ card.detail }}
      </p>
      <div v-if="card.packageTypeTags.length > 0" class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <span
          v-for="item in card.packageTypeTags"
          :key="item.label"
          class="text-sm text-(--dashboard-text-soft)"
        >
          {{ item.label }} {{ item.value }}
        </span>
      </div>
    </article>
  </section>
</template>
