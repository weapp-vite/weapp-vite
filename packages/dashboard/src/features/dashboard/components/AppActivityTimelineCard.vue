<script setup lang="ts">
import type { WorkspaceActivityItem } from '../types'
import AppSectionHeading from './AppSectionHeading.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'
import DashboardIcon from './DashboardIcon.vue'

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
      <li
        v-for="item in items"
        :key="`${item.time}-${item.title}`"
        class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4"
      >
        <div class="flex items-start gap-3">
          <span class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]">
            <span class="h-5 w-5">
              <DashboardIcon :name="item.tone === 'live' ? 'status-live' : 'metric-time'" />
            </span>
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <strong class="tracking-tight">{{ item.title }}</strong>
              <span class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
                {{ item.time }}
              </span>
            </div>
            <p class="mt-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
              {{ item.summary }}
            </p>
          </div>
        </div>
      </li>
    </ol>
  </AppSurfaceCard>
</template>
