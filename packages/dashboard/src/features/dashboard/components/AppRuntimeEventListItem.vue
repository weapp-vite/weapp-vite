<script setup lang="ts">
import type { DashboardRuntimeBadgeItem, DashboardRuntimeEvent } from '../types'
import { computed } from 'vue'
import { createRuntimeEventBadgeItem, formatRuntimeEventMeta } from '../utils/format'
import AppMetaLabel from './AppMetaLabel.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

const props = defineProps<{
  event: DashboardRuntimeEvent
  selected?: boolean
}>()

const badge = computed<DashboardRuntimeBadgeItem>(() => createRuntimeEventBadgeItem(props.event))
const eventMeta = computed(() => formatRuntimeEventMeta(props.event))
const panelClassName = computed(() =>
  props.selected
    ? 'border-(--dashboard-border-strong) bg-(--dashboard-panel)'
    : 'border-(--dashboard-border)',
)
</script>

<template>
  <li
    class="rounded-md border bg-(--dashboard-panel-muted) px-4 py-3 transition"
    :class="panelClassName"
  >
    <div class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate font-medium text-(--dashboard-text)" :title="props.event.title">
          {{ props.event.title }}
        </p>
        <AppMetaLabel class="mt-1">
          {{ eventMeta }}
        </AppMetaLabel>
      </div>
      <AppRuntimeBadge class="shrink-0" v-bind="badge" />
    </div>
  </li>
</template>
