<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIconFeatureCard from '../features/dashboard/components/AppIconFeatureCard.vue'
import AppInsetPanel from '../features/dashboard/components/AppInsetPanel.vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { releaseChecklist, workspaceHighlights, workspaceNavigation } from '../features/dashboard/constants/shell'

const { commandItems, signals } = useDashboardWorkspace()
</script>

<template>
  <div class="grid gap-3">
    <AppSurfaceCard
      eyebrow="Workspace"
      title="面向持续增强的 dashboard 壳子"
      description="这一版先不急着继续堆业务逻辑，而是把信息架构、导航分层、主题切换和组件基座先收住。后面要接 analyze、dev server、MCP 或任务执行状态，都可以直接沿着路由扩展。"
      icon-name="hero-workspace"
      tone="strong"
      padding="header"
    >
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
        <div class="grid gap-3 md:grid-cols-3">
          <AppIconFeatureCard
            v-for="item in workspaceHighlights"
            :key="item.title"
            :icon-name="item.iconName"
            :title="item.title"
            :description="item.description"
            :eyebrow="item.eyebrow"
          />
        </div>

        <div class="grid gap-3">
          <AppInsetPanel eyebrow="rollout signal">
            <ul class="grid gap-2 text-sm">
              <li
                v-for="item in signals"
                :key="item.label"
                class="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-3"
              >
                <span class="inline-flex items-center gap-2">
                  <span class="h-4.5 w-4.5 text-[color:var(--dashboard-accent)]">
                    <DashboardIcon :name="item.iconName" />
                  </span>
                  {{ item.label }}
                </span>
                <strong class="text-[color:var(--dashboard-text)]">{{ item.value }}</strong>
              </li>
            </ul>
          </AppInsetPanel>
        </div>
      </div>
    </AppSurfaceCard>

    <AppSurfaceCard
      eyebrow="Routes"
      title="页面跳转入口"
      description="工作台本身也要承担路由索引职责，后续页面越来越多时，首页需要负责把用户送到正确的功能区域。"
      icon-name="nav-home"
    >
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RouterLink
          v-for="item in workspaceNavigation"
          :key="item.to"
          :to="item.to"
        >
          <AppIconFeatureCard
            :icon-name="item.iconName"
            :title="item.label"
            :description="item.caption"
            interactive
          />
        </RouterLink>
      </div>
    </AppSurfaceCard>

    <section class="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
      <AppSurfaceCard tone="default" padding="md">
        <AppSectionHeading
          eyebrow="Commands"
          title="首轮操作面板"
          description="这里先用假数据承载常用动作。等 CLI 和 dashboard 进一步打通后，可以把这些条目替换成真实任务状态、最近运行记录和直接操作入口。"
        />
        <div class="mt-4 grid gap-3">
          <article
            v-for="command in commandItems"
            :key="command.command"
            class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4"
          >
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 class="font-medium">
                  {{ command.label }}
                </h3>
                <p class="mt-1 text-sm text-[color:var(--dashboard-text-muted)]">
                  {{ command.note }}
                </p>
              </div>
              <code class="rounded-xl bg-slate-950 px-3 py-2 text-xs text-slate-100 dark:bg-slate-900">
                {{ command.command }}
              </code>
            </div>
          </article>
        </div>
      </AppSurfaceCard>

      <AppSurfaceCard
        eyebrow="Guardrails"
        title="第一轮增强原则"
        description="先做壳子，不急着过度抽象数据模型。所有新增页面都要能在没有真实 payload 的情况下独立预览。"
        icon-name="metric-quality"
      >
        <ol class="grid gap-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          <li
            v-for="item in releaseChecklist"
            :key="item"
            class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3"
          >
            {{ item }}
          </li>
        </ol>
      </AppSurfaceCard>
    </section>
  </div>
</template>
