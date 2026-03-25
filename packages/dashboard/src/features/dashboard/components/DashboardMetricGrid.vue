<script setup lang="ts">
import type { DashboardMetricCard, SummaryMetric } from '../types'
import { formatPackageType } from '../utils/format'
import { iconFrameStyles, surfaceStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  cards: DashboardMetricCard[]
  packageTypeSummary: SummaryMetric[]
}>()
</script>

<template>
  <section class="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
    <article
      v-for="card in cards"
      :key="card.label"
      :class="[surfaceStyles({ padding: 'md' }), card.wide ? 'xl:col-span-2' : 'xl:col-span-1']"
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
      <div v-if="card.label === '总产物体积'" class="mt-3 flex flex-wrap gap-1.5">
        <span
          v-for="item in packageTypeSummary"
          :key="item.label"
          class="rounded-full border border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-accent-soft)] px-3 py-1 text-xs text-[color:var(--dashboard-text)]"
        >
          {{ formatPackageType(item.label) }} {{ item.value }}
        </span>
      </div>
    </article>
  </section>
</template>
