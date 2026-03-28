<script setup lang="ts">
import type { WorkspaceDiagnosticItem } from '../types'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
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
      <li
        v-for="item in items"
        :key="item.label"
        class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-medium">
              {{ item.label }}
            </p>
            <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
              {{ item.detail }}
            </p>
          </div>
          <AppRuntimeBadge :label="item.status" tone="info" />
        </div>
      </li>
    </ul>
  </AppSurfaceCard>
</template>
