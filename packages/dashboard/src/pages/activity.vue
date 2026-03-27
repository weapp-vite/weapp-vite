<script setup lang="ts">
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import { activityFeed, diagnosticsQueue } from '../features/dashboard/constants/shell'
</script>

<template>
  <div class="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
    <AppSurfaceCard tone="strong" padding="md">
      <AppSectionHeading
        eyebrow="Timeline"
        title="活动流与增强节奏"
        description="这一页先承载假数据时间线，后续最适合接入 dev server 事件、构建阶段、HMR 推送和 CLI 诊断结果。"
      />
      <ol class="mt-5 grid gap-3">
        <li
          v-for="item in activityFeed"
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

    <div class="grid gap-3">
      <AppSurfaceCard
        eyebrow="Diagnostics"
        title="当前诊断队列"
        description="这里不是产品逻辑页，而是 dashboard 未来最需要的第二层能力: 把运行状态和建议动作结构化展示。"
        icon-name="metric-health"
      >
        <ul class="grid gap-2">
          <li
            v-for="item in diagnosticsQueue"
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
              <span class="rounded-full bg-[color:var(--dashboard-accent-soft)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--dashboard-accent)]">
                {{ item.status }}
              </span>
            </div>
          </li>
        </ul>
      </AppSurfaceCard>

      <AppSurfaceCard
        eyebrow="Next"
        title="后续接入建议"
        description="如果继续增强，这一页优先接真实事件流，其次再做更细的过滤、搜索和日志详情。"
        icon-name="hero-commands"
      >
        <ul class="grid gap-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          <li class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3">
            将 CLI 生命周期拆成标准事件流，例如 `command:start`、`bundle:done`、`diagnostic:error`。
          </li>
          <li class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3">
            为每条事件保留来源、阶段、耗时和建议动作，避免日志只有原始文本。
          </li>
          <li class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3">
            把最近任务和事件筛选器提升成通用状态层，供 analyze 和未来页面共享。
          </li>
        </ul>
      </AppSurfaceCard>
    </div>
  </div>
</template>
