<script setup lang="ts">
import type { DashboardRuntimeEvent } from '../types'
import { formatRuntimeEventLevel, formatRuntimeEventMeta, getRuntimeEventBadgeTone } from '../utils/format'
import AppMetaLabel from './AppMetaLabel.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppTagList from './AppTagList.vue'

defineProps<{
  event: DashboardRuntimeEvent
  selected?: boolean
}>()
</script>

<template>
  <li
    class="rounded-[18px] border bg-[color:var(--dashboard-panel-muted)] px-4 py-3 transition"
    :class="selected
      ? 'border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel)]'
      : 'border-[color:var(--dashboard-border)]'"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-medium text-[color:var(--dashboard-text)]">
          {{ event.title }}
        </p>
        <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          {{ event.detail }}
        </p>
        <AppMetaLabel class="mt-2">
          {{ formatRuntimeEventMeta(event) }}
        </AppMetaLabel>
        <AppTagList v-if="event.tags?.length" class="mt-2" :tags="event.tags" />
      </div>
      <AppRuntimeBadge
        :label="formatRuntimeEventLevel(event.level)"
        :tone="getRuntimeEventBadgeTone(event.level)"
      />
    </div>
  </li>
</template>
