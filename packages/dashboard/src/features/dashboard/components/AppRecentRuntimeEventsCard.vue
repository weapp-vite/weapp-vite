<script setup lang="ts">
import type { DashboardRuntimeEvent } from '../types'
import AppRuntimeEventCard from './AppRuntimeEventCard.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'

defineProps<{
  events: DashboardRuntimeEvent[]
}>()
</script>

<template>
  <AppSurfaceCard
    eyebrow="Recent Feed"
    title="最近事件样本"
    description="这些事件是分析页最直接的上游线索。后面如果某次 analyze 或 build 结果异常，这里会比看全量时间线更快定位。"
    icon-name="hero-commands"
  >
    <ul class="grid gap-2">
      <li
        v-for="event in events"
        :key="event.id"
        class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3"
      >
        <AppRuntimeEventCard :event="event" />
      </li>
    </ul>
  </AppSurfaceCard>
</template>
