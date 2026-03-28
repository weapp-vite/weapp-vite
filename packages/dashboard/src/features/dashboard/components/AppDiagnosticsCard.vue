<script setup lang="ts">
import type { WorkspaceDiagnosticItem } from '../types'
import AppDiagnosticItem from './AppDiagnosticItem.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'

defineProps<{
  items: WorkspaceDiagnosticItem[]
}>()
</script>

<template>
  <AppSurfaceCard
    eyebrow="Diagnostics"
    title="当前诊断队列"
    description="这里不是产品逻辑页，而是 dashboard 未来最需要的第二层能力: 把运行状态和建议动作结构化展示。"
    icon-name="metric-health"
  >
    <ul class="grid gap-2">
      <AppDiagnosticItem
        v-for="item in items"
        :key="item.label"
        :label="item.label"
        :detail="item.detail"
        :status="item.status"
      />
    </ul>
  </AppSurfaceCard>
</template>
