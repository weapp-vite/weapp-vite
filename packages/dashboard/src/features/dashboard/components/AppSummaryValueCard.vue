<script setup lang="ts">
import type { DashboardDetailItem } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  title: DashboardDetailItem['title']
  meta: DashboardDetailItem['meta']
  value?: DashboardDetailItem['value']
  breakTitle?: boolean
}>()

const titleClassName = computed(() => props.breakTitle ? 'break-all' : undefined)
</script>

<template>
  <article class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3.5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p
          class="font-medium text-[color:var(--dashboard-text)]"
          :class="titleClassName"
        >
          {{ title }}
        </p>
        <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
          {{ meta }}
        </p>
      </div>
      <p
        v-if="value"
        class="font-medium text-[color:var(--dashboard-accent)]"
      >
        {{ value }}
      </p>
    </div>
    <slot />
  </article>
</template>
