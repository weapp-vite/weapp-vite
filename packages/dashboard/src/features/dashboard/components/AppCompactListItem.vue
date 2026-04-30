<script setup lang="ts">
import type { DashboardDetailItem } from '../types'

defineProps<{
  title: DashboardDetailItem['title']
  meta: DashboardDetailItem['meta']
  value?: DashboardDetailItem['value']
  monoTitle?: boolean
  clickable?: boolean
  active?: boolean
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <li
    v-if="!clickable"
    class="rounded-xl border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5"
    :class="active ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : undefined"
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
  <li v-else class="list-none">
    <button
      type="button"
      class="w-full rounded-xl border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 text-left transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
      :class="active ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : undefined"
      @click="emit('select')"
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
    </button>
  </li>
</template>
