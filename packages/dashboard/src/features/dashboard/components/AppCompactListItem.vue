<script setup lang="ts">
import type { DashboardDetailItem } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  title: DashboardDetailItem['title']
  meta: DashboardDetailItem['meta']
  value?: DashboardDetailItem['value']
  monoTitle?: boolean
}>()

const titleClassName = computed(() =>
  props.monoTitle
    ? 'truncate font-mono text-xs text-[color:var(--dashboard-text)]'
    : 'truncate text-[color:var(--dashboard-text)]',
)
</script>

<template>
  <li class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-3 py-2.5">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p
          class="font-medium"
          :class="titleClassName"
        >
          {{ title }}
        </p>
        <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
          {{ meta }}
        </p>
      </div>
      <span
        v-if="value"
        class="whitespace-nowrap font-medium text-[color:var(--dashboard-accent)]"
      >
        {{ value }}
      </span>
    </div>
  </li>
</template>
