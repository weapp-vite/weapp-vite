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
      class="text-[11px] uppercase tracking-[0.22em] text-(--dashboard-accent)"
    >
      {{ eyebrow }}
    </p>
    <div :class="eyebrow ? 'mt-3 flex items-start gap-3' : 'flex items-start gap-3'">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-(--dashboard-accent-soft) text-(--dashboard-accent)">
        <span class="h-5 w-5">
          <DashboardIcon :name="iconName" />
        </span>
      </span>
      <div class="min-w-0">
        <h3 class="font-semibold tracking-tight">
          {{ title }}
        </h3>
        <p
          v-if="meta"
          class="mt-1 text-xs uppercase tracking-[0.16em] text-(--dashboard-text-soft)"
        >
          {{ meta }}
        </p>
        <p
          v-if="description"
          class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)"
        >
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>
