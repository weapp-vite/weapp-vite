<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIconFeatureCard from '../features/dashboard/components/AppIconFeatureCard.vue'
import AppInsetPanel from '../features/dashboard/components/AppInsetPanel.vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import WorkspaceActivityTimeline from '../features/dashboard/components/WorkspaceActivityTimeline.vue'
import WorkspaceCommandCenter from '../features/dashboard/components/WorkspaceCommandCenter.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { releaseChecklist, workspaceNavigation } from '../features/dashboard/constants/shell'

const { activityItems, commandItems, signals } = useDashboardWorkspace()
</script>

<template>
  <div class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.72fr)]">
    <AppSurfaceCard
      eyebrow="Status"
      title="当前工作区"
      icon-name="status-live"
      tone="strong"
      padding="md"
      content-class="min-h-0 overflow-hidden"
    >
      <div class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
        <AppInsetPanel>
          <ul class="grid gap-2 text-sm md:grid-cols-2">
            <li
              v-for="item in signals"
              :key="item.label"
              class="flex items-center justify-between gap-3 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-3"
            >
              <span class="inline-flex min-w-0 items-center gap-2">
                <span class="h-4.5 w-4.5 shrink-0 text-(--dashboard-accent)">
                  <DashboardIcon :name="item.iconName" />
                </span>
                <span class="truncate">{{ item.label }}</span>
              </span>
              <strong class="shrink-0 text-(--dashboard-text)">{{ item.value }}</strong>
            </li>
          </ul>
        </AppInsetPanel>

        <div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <RouterLink v-for="item in workspaceNavigation" :key="item.to" :to="item.to">
            <AppIconFeatureCard
              :icon-name="item.iconName"
              :title="item.label"
              interactive
            />
          </RouterLink>
        </div>

        <WorkspaceActivityTimeline
          :items="activityItems"
          :checklist="releaseChecklist"
        />
      </div>
    </AppSurfaceCard>

    <section class="grid min-h-0 gap-3 overflow-hidden">
      <AppSurfaceCard tone="default" padding="md" content-class="min-h-0 overflow-hidden">
        <AppSectionHeading
          eyebrow="Commands"
          title="常用操作"
        />
        <div class="mt-4 h-[calc(100dvh-13rem)] min-h-80">
          <WorkspaceCommandCenter :commands="commandItems" />
        </div>
      </AppSurfaceCard>
    </section>
  </div>
</template>
