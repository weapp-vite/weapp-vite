<script setup lang="ts">
import type { DashboardRuntimeBadgeItem, DashboardRuntimeEvent } from '../types'
import { computed } from 'vue'
import { formatRuntimeEventLevel, formatRuntimeEventMeta, getRuntimeEventBadgeTone } from '../utils/format'
import { mutedPanelStyles } from '../utils/styles'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

const props = defineProps<{
  event: DashboardRuntimeEvent | null
  eyebrow?: string
  emptyTitle?: string
  emptyDetail?: string
  durationText?: string
}>()

const badge = computed<DashboardRuntimeBadgeItem | null>(() => (
  props.event
    ? {
        label: formatRuntimeEventLevel(props.event.level),
        tone: getRuntimeEventBadgeTone(props.event.level),
      }
    : null
))
</script>

<template>
  <div :class="mutedPanelStyles()">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p v-if="props.eyebrow" class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-accent)]">
          {{ props.eyebrow }}
        </p>
        <h3 class="mt-1 text-lg font-semibold tracking-tight">
          {{ props.event?.title ?? props.emptyTitle ?? '尚无运行事件' }}
        </h3>
      </div>
      <AppRuntimeBadge v-if="badge" v-bind="badge" />
    </div>
    <p class="mt-3 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
      {{ props.event?.detail ?? props.emptyDetail ?? '当前工作区还没有推入结构化运行事件。' }}
    </p>
    <p
      v-if="props.event"
      class="mt-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]"
    >
      {{ formatRuntimeEventMeta(props.event) }}
    </p>
    <p
      v-if="props.durationText"
      class="mt-2 text-sm font-medium text-[color:var(--dashboard-text)]"
    >
      {{ props.durationText }}
    </p>
    <slot />
  </div>
</template>
