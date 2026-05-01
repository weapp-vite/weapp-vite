<script setup lang="ts">
import type { RuntimeIncidentDigest, RuntimeIncidentDigestStatus } from '../utils/runtimeIncidentDigest'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import AppEmptyState from './AppEmptyState.vue'
import AppMetricTile from './AppMetricTile.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  digest: RuntimeIncidentDigest
}>()

const copyStatus = ref('')
let copyStatusTimer: ReturnType<typeof setTimeout> | null = null

const badgeTone = computed(() => {
  if (props.digest.status === 'critical') {
    return 'error'
  }
  if (props.digest.status === 'warning') {
    return 'warning'
  }
  return 'success'
})

function getLevelClassName(level: RuntimeIncidentDigest['incidents'][number]['level']) {
  if (level === 'error') {
    return 'text-rose-600 dark:text-rose-300'
  }
  if (level === 'warning') {
    return 'text-amber-600 dark:text-amber-300'
  }
  return 'text-(--dashboard-accent)'
}

function getStatusAccentClassName(status: RuntimeIncidentDigestStatus) {
  if (status === 'critical') {
    return 'border-rose-400/60 bg-(--dashboard-panel-muted)'
  }
  if (status === 'warning') {
    return 'border-amber-400/60 bg-(--dashboard-panel-muted)'
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

async function copyDigestReport() {
  try {
    await copyText(props.digest.report)
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
    eyebrow="Incident"
    title="事故摘要"
    icon-name="metric-quality"
  >
    <template #header>
      <div class="flex shrink-0 items-center gap-2">
        <span v-if="copyStatus" class="text-xs font-medium text-(--dashboard-accent)">
          {{ copyStatus }}
        </span>
        <button
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-xs text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
          @click="copyDigestReport"
        >
          <span class="h-3.5 w-3.5">
            <DashboardIcon name="metric-copy" />
          </span>
          复制
        </button>
      </div>
    </template>

    <div class="grid gap-3">
      <div class="rounded-md border px-3 py-2.5" :class="getStatusAccentClassName(digest.status)">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-(--dashboard-text)">
              {{ digest.statusLabel }}
            </p>
            <p class="mt-1 text-xs leading-5 text-(--dashboard-text-muted)">
              {{ digest.statusDetail }}
            </p>
          </div>
          <AppRuntimeBadge :label="digest.statusLabel" :tone="badgeTone" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-2 2xl:grid-cols-5">
        <AppMetricTile
          v-for="item in digest.metrics"
          :key="item.label"
          :label="item.label"
          :value="item.value"
        />
      </div>

      <div v-if="digest.incidents.length > 0" class="grid max-h-52 gap-2 overflow-y-auto pr-1">
        <article
          v-for="item in digest.incidents"
          :key="item.id"
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-(--dashboard-text)">
                {{ item.title }}
              </p>
              <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
                {{ item.source }} · {{ item.kindLabel }} · {{ item.timestamp }} · {{ item.duration }}
              </p>
            </div>
            <span class="shrink-0 text-xs font-semibold" :class="getLevelClassName(item.level)">
              {{ item.levelLabel }}
            </span>
          </div>
          <p class="mt-2 line-clamp-2 text-xs leading-5 text-(--dashboard-text-muted)">
            {{ item.reason }} · {{ item.detail }}
          </p>
        </article>
      </div>
      <AppEmptyState v-else compact>
        当前筛选范围内没有需要处理的运行时事件。
      </AppEmptyState>
    </div>
  </AppSurfaceCard>
</template>
