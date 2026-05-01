<script setup lang="ts">
import type { WorkspaceReadinessStatus, WorkspaceReadinessSummary } from '../utils/workspaceReadiness'
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { copyText } from '../utils/clipboard'
import AppMetricTile from './AppMetricTile.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  summary: WorkspaceReadinessSummary
}>()

const copyStatus = ref('')
let copyStatusTimer: ReturnType<typeof setTimeout> | null = null

const badgeTone = computed(() => {
  if (props.summary.status === 'attention') {
    return 'warning'
  }
  if (props.summary.status === 'pending') {
    return 'info'
  }
  return 'success'
})

function getStatusClassName(status: WorkspaceReadinessStatus) {
  if (status === 'attention') {
    return 'border-amber-400/60 bg-(--dashboard-panel-muted)'
  }
  if (status === 'pending') {
    return 'border-(--dashboard-border-strong) bg-(--dashboard-panel-muted)'
  }
  return 'border-emerald-400/60 bg-(--dashboard-panel-muted)'
}

function setCopyStatus(status: string) {
  copyStatus.value = status
  if (copyStatusTimer) {
    clearTimeout(copyStatusTimer)
  }
  copyStatusTimer = setTimeout(() => {
    copyStatus.value = ''
    copyStatusTimer = null
  }, 1800)
}

async function copyReadinessReport() {
  try {
    await copyText(props.summary.report)
    setCopyStatus('摘要已复制')
  }
  catch {
    setCopyStatus('复制失败')
  }
}

onBeforeUnmount(() => {
  if (copyStatusTimer) {
    clearTimeout(copyStatusTimer)
  }
})
</script>

<template>
  <AppSurfaceCard
    eyebrow="Readiness"
    title="工作区摘要"
    icon-name="metric-ready"
  >
    <template #header>
      <div class="flex shrink-0 items-center gap-2">
        <span v-if="copyStatus" class="text-xs font-medium text-(--dashboard-accent)">
          {{ copyStatus }}
        </span>
        <button
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-xs text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
          @click="copyReadinessReport"
        >
          <span class="h-3.5 w-3.5">
            <DashboardIcon name="metric-copy" />
          </span>
          复制
        </button>
      </div>
    </template>

    <div class="grid gap-3">
      <div class="rounded-md border px-3 py-2.5" :class="getStatusClassName(summary.status)">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-(--dashboard-text)">
              {{ summary.statusLabel }}
            </p>
            <p class="mt-1 text-xs leading-5 text-(--dashboard-text-muted)">
              {{ summary.statusDetail }}
            </p>
          </div>
          <AppRuntimeBadge :label="summary.statusLabel" :tone="badgeTone" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 2xl:grid-cols-3">
        <AppMetricTile
          v-for="item in summary.metrics"
          :key="item.label"
          :label="item.label"
          :value="item.value"
        />
      </div>

      <div class="grid gap-2 sm:grid-cols-2">
        <RouterLink
          v-for="action in summary.actions"
          :key="action.id"
          :to="action.to"
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-(--dashboard-text)">
                {{ action.title }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs leading-5 text-(--dashboard-text-muted)">
                {{ action.detail }}
              </p>
            </div>
            <span class="shrink-0 text-xs font-semibold text-(--dashboard-accent)">
              {{ action.label }}
            </span>
          </div>
        </RouterLink>
      </div>

      <div
        v-if="summary.latestEvent"
        class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5"
      >
        <p class="text-[11px] uppercase tracking-[0.2em] text-(--dashboard-accent)">
          Latest Event
        </p>
        <div class="mt-2 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-(--dashboard-text)">
              {{ summary.latestEvent.title }}
            </p>
            <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
              {{ summary.latestEvent.timestamp }} · {{ summary.latestEvent.levelLabel }}
            </p>
          </div>
          <span class="h-4 w-4 shrink-0 text-(--dashboard-accent)">
            <DashboardIcon name="metric-time" />
          </span>
        </div>
      </div>
    </div>
  </AppSurfaceCard>
</template>
