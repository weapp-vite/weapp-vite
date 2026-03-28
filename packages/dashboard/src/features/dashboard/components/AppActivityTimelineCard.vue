<script setup lang="ts">
import type { WorkspaceActivityItem } from '../types'
import AppSectionHeading from './AppSectionHeading.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'
import AppTimelineItem from './AppTimelineItem.vue'

defineProps<{
  items: WorkspaceActivityItem[]
}>()
</script>

<template>
  <AppSurfaceCard tone="strong" padding="md">
    <AppSectionHeading
      eyebrow="Timeline"
      title="活动流与增强节奏"
      description="这一页先承载假数据时间线，后续最适合接入 dev server 事件、构建阶段、HMR 推送和 CLI 诊断结果。"
    />
    <ol class="mt-5 grid gap-3">
      <AppTimelineItem
        v-for="item in items"
        :key="`${item.time}-${item.title}`"
        :title="item.title"
        :time="item.time"
        :summary="item.summary"
        :icon-name="item.tone === 'live' ? 'status-live' : 'metric-time'"
      />
    </ol>
  </AppSurfaceCard>
</template>
