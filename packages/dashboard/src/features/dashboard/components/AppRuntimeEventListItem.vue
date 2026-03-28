<script setup lang="ts">
import type { DashboardRuntimeBadgeItem, DashboardRuntimeEvent } from '../types'
import { computed } from 'vue'
import { formatRuntimeEventLevel, formatRuntimeEventMeta, getRuntimeEventBadgeTone } from '../utils/format'
import AppMetaLabel from './AppMetaLabel.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppTagList from './AppTagList.vue'

const props = defineProps<{
  event: DashboardRuntimeEvent
  selected?: boolean
}>()

function createRuntimeEventBadge(event: DashboardRuntimeEvent): DashboardRuntimeBadgeItem {
  return {
    label: formatRuntimeEventLevel(event.level),
    tone: getRuntimeEventBadgeTone(event.level),
  }
}

const badge = computed<DashboardRuntimeBadgeItem>(() => createRuntimeEventBadge(props.event))
const eventMeta = computed(() => formatRuntimeEventMeta(props.event))
</script>

<template>
  <li
    class="rounded-[18px] border bg-[color:var(--dashboard-panel-muted)] px-4 py-3 transition"
    :class="props.selected
      ? 'border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel)]'
      : 'border-[color:var(--dashboard-border)]'"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-medium text-[color:var(--dashboard-text)]">
          {{ props.event.title }}
        </p>
        <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          {{ props.event.detail }}
        </p>
        <AppMetaLabel class="mt-2">
          {{ eventMeta }}
        </AppMetaLabel>
        <AppTagList v-if="props.event.tags?.length" class="mt-2" :tags="props.event.tags" />
      </div>
      <AppRuntimeBadge v-bind="badge" />
    </div>
  </li>
</template>
