<script setup lang="ts">
import type { DashboardDetailItem } from '../types'

defineProps<{
  title: DashboardDetailItem['title']
  meta: DashboardDetailItem['meta']
  value?: DashboardDetailItem['value']
  monoTitle?: boolean
  clickable?: boolean
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <li
    class="rounded-xl border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5"
    :class="clickable ? 'cursor-pointer transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)' : undefined"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable && emit('select')"
    @keydown.enter="clickable && emit('select')"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p
          class="font-medium"
          :class="monoTitle ? 'truncate font-mono text-xs text-(--dashboard-text)' : 'truncate text-(--dashboard-text)'"
        >
          {{ title }}
        </p>
        <p class="mt-1 text-xs text-(--dashboard-text-soft)">
          {{ meta }}
        </p>
      </div>
      <span
        v-if="value"
        class="whitespace-nowrap font-medium text-(--dashboard-accent)"
      >
        {{ value }}
      </span>
    </div>
  </li>
</template>
