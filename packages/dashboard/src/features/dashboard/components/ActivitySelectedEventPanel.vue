<script setup lang="ts">
import type { DashboardRuntimeEvent } from '../types'
import { computed } from 'vue'
import { formatDuration } from '../utils/format'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppRuntimeFocusCard from './AppRuntimeFocusCard.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'

const props = defineProps<{
  event: DashboardRuntimeEvent | null
}>()

const durationText = computed(() => props.event?.durationMs !== undefined
  ? `耗时 ${formatDuration(props.event.durationMs)}`
  : undefined)
</script>

<template>
  <AppSurfaceCard
    eyebrow="Selected"
    title="当前事件"
    icon-name="metric-search"
  >
    <AppRuntimeFocusCard
      :event="event"
      eyebrow="focus"
      empty-title="未选择事件"
      empty-detail="选择左侧事件后查看详情。"
      :duration-text="durationText"
    >
      <div v-if="event?.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
        <AppRuntimeBadge
          v-for="tag in event.tags"
          :key="tag"
          :label="tag"
          tone="neutral"
        />
      </div>
    </AppRuntimeFocusCard>
  </AppSurfaceCard>
</template>
