<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppSurfaceCard from './AppSurfaceCard.vue'
</script>

<template>
  <AppSurfaceCard
    eyebrow="Analyze"
    title="等待分析数据注入"
    icon-name="hero-commands"
    tone="strong"
    padding="header"
  >
    <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.92fr)]">
      <div class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-4">
        <p class="text-[11px] uppercase tracking-[0.24em] text-(--dashboard-text-soft)">
          recommended commands
        </p>
        <div class="mt-4 grid gap-2">
          <code
            v-for="command in [
              'weapp-vite analyze',
              'weapp-vite build --ui',
              'weapp-vite dev --ui',
            ]"
            :key="command"
            class="rounded-md bg-slate-950 px-3 py-3 text-xs text-slate-100 dark:bg-slate-900"
          >
            {{ command }}
          </code>
        </div>
      </div>

      <div class="grid gap-2">
        <RouterLink
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-4 py-4 transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
          to="/"
        >
          <p class="font-medium">
            返回工作台
          </p>
          <p class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
            查看当前状态和命令。
          </p>
        </RouterLink>
        <RouterLink
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-4 py-4 transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
          to="/activity"
        >
          <p class="font-medium">
            查看活动流
          </p>
          <p class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
            观察命令、构建、HMR 和诊断事件。
          </p>
        </RouterLink>
      </div>
    </div>
  </AppSurfaceCard>
</template>
