<script setup lang="ts">
import type { DashboardRuntimeEvent } from '../types'
import { RouterLink } from 'vue-router'
import { cn } from '../../../lib/cn'

const props = defineProps<{
  events: DashboardRuntimeEvent[]
}>()

function resolveEventTone(level: DashboardRuntimeEvent['level']) {
  if (level === 'error') {
    return 'bg-red-500'
  }
  if (level === 'warning') {
    return 'bg-amber-500'
  }
  if (level === 'success') {
    return 'bg-emerald-500'
  }
  return 'bg-sky-500'
}
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel)">
    <header class="flex min-h-11 min-w-0 items-center justify-between gap-2 border-b border-(--dashboard-border) px-3.5 py-2">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-(--dashboard-text)">
          Runtime events
        </h2>
        <p class="truncate text-[11px] text-(--dashboard-text-soft)">
          Build、HMR 与诊断的最新状态
        </p>
      </div>
      <RouterLink class="shrink-0 text-xs font-medium text-(--dashboard-accent) hover:underline" to="/activity">
        打开事件流
      </RouterLink>
    </header>

    <ol v-if="props.events.length" class="divide-y divide-(--dashboard-border)">
      <li
        v-for="event in props.events.slice(0, 8)"
        :key="event.id"
        class="grid grid-cols-[0.5rem_minmax(0,1fr)_auto] items-start gap-2.5 px-3.5 py-2.5"
      >
        <span :class="cn('mt-1.5 h-1.5 w-1.5 rounded-full', resolveEventTone(event.level))" />
        <span class="min-w-0">
          <span class="block truncate text-xs font-medium text-(--dashboard-text)">{{ event.title }}</span>
          <span class="mt-0.5 block truncate text-[11px] text-(--dashboard-text-soft)">{{ event.detail }}</span>
        </span>
        <span class="font-mono text-[10px] text-(--dashboard-text-soft)">{{ event.timestamp }}</span>
      </li>
    </ol>

    <div v-else class="px-4 py-10 text-center">
      <p class="text-sm font-medium text-(--dashboard-text)">
        暂无运行事件
      </p>
      <p class="mt-1 text-xs text-(--dashboard-text-soft)">
        构建、HMR 和诊断事件会实时出现在这里。
      </p>
    </div>
  </section>
</template>
