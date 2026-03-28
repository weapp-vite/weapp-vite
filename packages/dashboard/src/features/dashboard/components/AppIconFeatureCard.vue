<script setup lang="ts">
import type { DashboardIconFeatureItem } from '../types'
import { mutedPanelStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  iconName: DashboardIconFeatureItem['iconName']
  title: DashboardIconFeatureItem['title']
  description?: DashboardIconFeatureItem['description']
  eyebrow?: DashboardIconFeatureItem['eyebrow']
  interactive?: boolean
  meta?: DashboardIconFeatureItem['meta']
}>()
</script>

<template>
  <div
    :class="mutedPanelStyles({ interactive })"
  >
    <p
      v-if="eyebrow"
      class="text-[11px] uppercase tracking-[0.22em] text-[color:var(--dashboard-accent)]"
    >
      {{ eyebrow }}
    </p>
    <div class="mt-3 flex items-start gap-3">
      <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]">
        <span class="h-5 w-5">
          <DashboardIcon :name="iconName" />
        </span>
      </span>
      <div>
        <h3 class="font-semibold tracking-tight">
          {{ title }}
        </h3>
        <p
          v-if="meta"
          class="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--dashboard-text-soft)]"
        >
          {{ meta }}
        </p>
        <p
          v-if="description"
          class="mt-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]"
        >
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>
