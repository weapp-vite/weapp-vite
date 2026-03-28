<script setup lang="ts">
import type { DashboardTitleBlock } from '../types'

withDefaults(defineProps<{
  eyebrow?: string
  title: DashboardTitleBlock['title']
  description?: DashboardTitleBlock['description']
}>(), {
  eyebrow: undefined,
  description: undefined,
})
</script>

<template>
  <div class="space-y-1.5">
    <p v-if="eyebrow" class="text-[11px] uppercase tracking-[0.28em] text-[color:var(--dashboard-accent)]">
      {{ eyebrow }}
    </p>
    <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="text-xl font-semibold tracking-tight md:text-2xl">
          {{ title }}
        </h2>
        <p v-if="description" class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          {{ description }}
        </p>
      </div>
      <slot name="aside" />
    </div>
  </div>
</template>
