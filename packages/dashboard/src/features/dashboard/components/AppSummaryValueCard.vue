<script setup lang="ts">
import type { DashboardDetailItem } from '../types'

defineProps<{
  title: DashboardDetailItem['title']
  meta: DashboardDetailItem['meta']
  value?: DashboardDetailItem['value']
  breakTitle?: boolean
}>()
</script>

<template>
  <article class="rounded-xl border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3.5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p
          class="font-medium text-(--dashboard-text)"
          :class="breakTitle ? 'break-all' : undefined"
        >
          {{ title }}
        </p>
        <p class="mt-1 text-xs text-(--dashboard-text-soft)">
          {{ meta }}
        </p>
      </div>
      <p
        v-if="value"
        class="font-medium text-(--dashboard-accent)"
      >
        {{ value }}
      </p>
    </div>
    <slot />
  </article>
</template>
