<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import DevtoolsMetricStrip from '../features/dashboard/components/DevtoolsMetricStrip.vue'
import DevtoolsPackageList from '../features/dashboard/components/DevtoolsPackageList.vue'
import DevtoolsRuntimeFeed from '../features/dashboard/components/DevtoolsRuntimeFeed.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import {
  dashboardConnectionError,
  dashboardConnectionStatus,
} from '../features/dashboard/utils/dashboardDevframe'
import { formatBytes } from '../features/dashboard/utils/format'

const {
  lastUpdatedAt,
  resultRef,
  runtimeEvents,
  updateCount,
} = useDashboardWorkspace()

const totalBytes = computed(() =>
  resultRef.value?.packages.reduce((packageTotal, packageReport) =>
    packageTotal + packageReport.files.reduce((fileTotal, file) => fileTotal + (file.size ?? 0), 0), 0) ?? 0,
)
const metricItems = computed(() => [
  {
    label: 'Session',
    value: dashboardConnectionStatus.value === 'connected' ? 'Connected' : dashboardConnectionStatus.value,
    detail: resultRef.value ? 'Analyze payload 已同步' : '等待 Devframe 数据',
  },
  {
    label: 'Output',
    value: formatBytes(totalBytes.value),
    detail: `${resultRef.value?.packages.length ?? 0} packages`,
  },
  {
    label: 'Modules',
    value: String(resultRef.value?.modules.length ?? 0),
    detail: `${resultRef.value?.subPackages.length ?? 0} subpackages`,
  },
  {
    label: 'Last update',
    value: lastUpdatedAt.value,
    detail: `${updateCount.value} syncs`,
  },
])
const packageRows = computed(() =>
  (resultRef.value?.packages ?? [])
    .map(packageReport => ({
      id: packageReport.id,
      label: packageReport.label,
      type: packageReport.type,
      fileCount: packageReport.files.length,
      bytes: packageReport.files.reduce((total, file) => total + (file.size ?? 0), 0),
    }))
    .sort((left, right) => right.bytes - left.bytes)
    .map(packageReport => ({
      ...packageReport,
      size: formatBytes(packageReport.bytes),
    })),
)
const blockingEvents = computed(() =>
  runtimeEvents.value.filter(event => event.level === 'error' || event.level === 'warning').slice(0, 5),
)
</script>

<template>
  <div class="grid gap-3">
    <DevtoolsMetricStrip :items="metricItems" />

    <div class="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
      <div class="grid min-h-0 gap-3">
        <DevtoolsPackageList :rows="packageRows" />

        <section class="overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel)">
          <header class="flex min-h-11 min-w-0 items-center justify-between gap-2 border-b border-(--dashboard-border) px-3.5 py-2">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-(--dashboard-text)">
                Diagnostics
              </h2>
              <p class="truncate text-[11px] text-(--dashboard-text-soft)">
                当前会话的阻塞项和恢复入口
              </p>
            </div>
            <RouterLink class="shrink-0 text-xs font-medium text-(--dashboard-accent) hover:underline" to="/analyze?tab=diagnostics">
              打开诊断
            </RouterLink>
          </header>

          <div v-if="dashboardConnectionError" class="border-b border-(--dashboard-border) bg-red-500/8 px-3.5 py-3">
            <p class="text-xs font-semibold text-red-600 dark:text-red-300">
              Devframe connection error
            </p>
            <p class="mt-1 break-words font-mono text-[11px] leading-5 text-(--dashboard-text-muted)">
              {{ dashboardConnectionError.message }}
            </p>
          </div>

          <ul v-if="blockingEvents.length" class="divide-y divide-(--dashboard-border)">
            <li v-for="event in blockingEvents" :key="event.id" class="px-3.5 py-2.5">
              <div class="flex items-center justify-between gap-3">
                <p class="truncate text-xs font-medium text-(--dashboard-text)">
                  {{ event.title }}
                </p>
                <span class="font-mono text-[10px] uppercase text-(--dashboard-text-soft)">{{ event.level }}</span>
              </div>
              <p class="mt-1 line-clamp-2 text-[11px] leading-5 text-(--dashboard-text-muted)">
                {{ event.detail }}
              </p>
            </li>
          </ul>

          <div v-else-if="!dashboardConnectionError" class="flex items-center gap-2.5 px-3.5 py-5">
            <span class="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              <span class="block text-xs font-medium text-(--dashboard-text)">No blocking diagnostics</span>
              <span class="mt-0.5 block text-[11px] text-(--dashboard-text-soft)">当前连接、构建和运行事件没有错误或警告。</span>
            </span>
          </div>
        </section>
      </div>

      <DevtoolsRuntimeFeed :events="runtimeEvents" />
    </div>
  </div>
</template>
