<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import DevtoolsMetricStrip from '../features/dashboard/components/DevtoolsMetricStrip.vue'
import DevtoolsPackageList from '../features/dashboard/components/DevtoolsPackageList.vue'
import DevtoolsRuntimeFeed from '../features/dashboard/components/DevtoolsRuntimeFeed.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { dashboardConnectionLabels } from '../features/dashboard/constants/shell'
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
    label: '连接状态',
    value: dashboardConnectionLabels[dashboardConnectionStatus.value],
    detail: resultRef.value ? '已收到构建报告' : '尚未收到构建报告',
  },
  {
    label: '产物体积',
    value: resultRef.value ? formatBytes(totalBytes.value) : '—',
    detail: resultRef.value ? `${resultRef.value.packages.length} 个包体` : '等待构建报告',
  },
  {
    label: '源码模块',
    value: resultRef.value ? String(resultRef.value.modules.length) : '—',
    detail: resultRef.value ? `${resultRef.value.subPackages.length} 个分包配置` : '等待构建报告',
  },
  {
    label: '最近同步',
    value: lastUpdatedAt.value,
    detail: `${updateCount.value} 次报告更新`,
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
const sessionNotice = computed(() => {
  if (!resultRef.value) {
    return {
      title: '等待构建报告',
      description: dashboardConnectionStatus.value === 'connected'
        ? '连接已建立，收到报告后即可查看构建分析。'
        : '尚未收到构建报告，暂时无法判断构建情况。',
    }
  }
  if (dashboardConnectionStatus.value !== 'connected') {
    return {
      title: '构建报告已保留',
      description: '当前未连接，显示最近一次收到的报告。',
    }
  }
  return runtimeEvents.value.length
    ? {
        title: '暂未收到错误或警告',
        description: '仅依据已收到的运行事件；构建问题请查看「构建分析」。',
      }
    : {
        title: '构建报告已收到',
        description: '尚未收到运行事件，暂时无法判断运行情况。',
      }
})
</script>

<template>
  <div class="grid gap-3">
    <DevtoolsMetricStrip :items="metricItems" />

    <div class="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
      <div class="grid min-h-0 gap-3">
        <section class="overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel)">
          <header class="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-2 border-b border-(--dashboard-border) px-3.5 py-2">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-(--dashboard-text)">
                会话提醒
              </h2>
              <p class="text-[13px] leading-5 text-(--dashboard-text-soft)">
                最近 5 条错误或警告
              </p>
            </div>
            <RouterLink class="shrink-0 text-[13px] font-medium text-(--dashboard-accent) hover:underline" to="/analyze?tab=diagnostics">
              查看构建问题
            </RouterLink>
          </header>

          <div v-if="dashboardConnectionError" class="border-b border-(--dashboard-border) bg-red-500/8 px-3.5 py-3">
            <p class="text-sm font-semibold text-red-600 dark:text-red-300">
              连接异常
            </p>
            <p class="mt-1 break-words font-mono text-[13px] leading-5 text-(--dashboard-text-muted)">
              {{ dashboardConnectionError.message }}
            </p>
          </div>

          <ul v-if="blockingEvents.length" class="divide-y divide-(--dashboard-border)">
            <li v-for="event in blockingEvents" :key="event.id" class="px-3.5 py-2.5">
              <div class="flex items-center justify-between gap-3">
                <p class="min-w-0 text-sm font-medium text-(--dashboard-text)">
                  {{ event.title }}
                </p>
                <span class="shrink-0 text-xs text-(--dashboard-text-soft)">{{ event.level === 'error' ? '错误' : '警告' }}</span>
              </div>
              <p class="mt-1 text-[13px] leading-5 text-(--dashboard-text-muted)">
                {{ event.detail }}
              </p>
            </li>
          </ul>

          <div v-else-if="!dashboardConnectionError" class="px-3.5 py-4">
            <p class="text-sm font-medium text-(--dashboard-text)">
              {{ sessionNotice.title }}
            </p>
            <p class="mt-1 text-[13px] leading-5 text-(--dashboard-text-muted)">
              {{ sessionNotice.description }}
            </p>
          </div>
        </section>

        <DevtoolsPackageList :rows="packageRows" />
      </div>

      <DevtoolsRuntimeFeed :events="runtimeEvents" />
    </div>
  </div>
</template>
