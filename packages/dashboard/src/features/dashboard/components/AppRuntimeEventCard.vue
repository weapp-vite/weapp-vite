<script setup lang="ts">
import type { DashboardRuntimeEvent } from '../types'
import { formatRuntimeEventLevel, formatRuntimeEventMeta, getRuntimeEventBadgeTone } from '../utils/format'
import AppMetaLabel from './AppMetaLabel.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

defineProps<{
  event: DashboardRuntimeEvent
}>()
</script>

<template>
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
    </div>
    <AppRuntimeBadge :label="formatRuntimeEventLevel(event.level)" :tone="getRuntimeEventBadgeTone(event.level)" />
  </div>
</template>
