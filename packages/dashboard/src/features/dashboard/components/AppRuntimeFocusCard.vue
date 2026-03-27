<script setup lang="ts">
import type { DashboardRuntimeEvent } from '../types'
import { formatRuntimeEventLevel, formatRuntimeEventMeta, getRuntimeEventBadgeTone } from '../utils/format'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

defineProps<{
  event: DashboardRuntimeEvent | null
  eyebrow?: string
  emptyTitle?: string
  emptyDetail?: string
  durationText?: string
}>()
</script>

<template>
  <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p v-if="eyebrow" class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-accent)]">
          {{ eyebrow }}
        </p>
        <h3 class="mt-1 text-lg font-semibold tracking-tight">
          {{ event?.title ?? emptyTitle ?? '尚无运行事件' }}
        </h3>
      </div>
      <AppRuntimeBadge
        v-if="event"
        :label="formatRuntimeEventLevel(event.level)"
        :tone="getRuntimeEventBadgeTone(event.level)"
      />
    </div>
    <p class="mt-3 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
      {{ event?.detail ?? emptyDetail ?? '当前工作区还没有推入结构化运行事件。' }}
    </p>
    <p
      v-if="event"
      class="mt-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]"
    >
      {{ formatRuntimeEventMeta(event) }}
    </p>
    <p
      v-if="durationText"
      class="mt-2 text-sm font-medium text-[color:var(--dashboard-text)]"
    >
      {{ durationText }}
    </p>
    <slot />
  </div>
</template>
