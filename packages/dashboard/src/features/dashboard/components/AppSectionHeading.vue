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
  <div>
    <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div class="min-w-0 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2.5">
        <p v-if="eyebrow" class="text-[11px] uppercase tracking-[0.28em] text-(--dashboard-accent)">
          {{ eyebrow }}
        </p>
        <h2 class="text-xl font-semibold tracking-tight md:text-2xl">
          {{ title }}
        </h2>
        <p v-if="description" class="mt-1 w-full text-sm leading-6 text-(--dashboard-text-muted)">
          {{ description }}
        </p>
      </div>
      <slot name="aside" />
    </div>
  </div>
</template>
