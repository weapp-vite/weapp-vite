<script setup lang="ts">
import type { AnalyzeActionCenterItem, AnalyzeActionCenterTone } from '../types'
import { computed } from 'vue'
import { runtimeBadgeStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  actions: AnalyzeActionCenterItem[]
  activeKey: string | null
}>()

const emit = defineEmits<{
  select: [item: AnalyzeActionCenterItem]
  copyReport: []
}>()

const visibleActions = computed(() => props.actions.slice(0, 3))

function getToneClassName(tone: AnalyzeActionCenterTone) {
  if (tone === 'critical') {
    return runtimeBadgeStyles({ tone: 'error' })
  }
  if (tone === 'warning') {
    return runtimeBadgeStyles({ tone: 'warning' })
  }
  if (tone === 'success') {
    return runtimeBadgeStyles({ tone: 'success' })
  }
  return runtimeBadgeStyles({ tone: 'info' })
}

function getToneLabel(tone: AnalyzeActionCenterTone) {
  if (tone === 'critical') {
    return '必须处理'
  }
  if (tone === 'warning') {
    return '建议处理'
  }
  if (tone === 'success') {
    return '可查看'
  }
  return '定位'
}
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="h-full min-h-0 overflow-hidden">
    <AppPanelHeader icon-name="metric-health" title="问题中心">
      <template #meta>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
          @click="emit('copyReport')"
        >
          <span class="h-3.5 w-3.5">
            <DashboardIcon name="metric-copy" />
          </span>
          复制 PR
        </button>
      </template>
    </AppPanelHeader>

    <div class="mt-3 min-h-0 flex-1 overflow-hidden">
      <AppEmptyState v-if="visibleActions.length === 0" compact>
        暂无需要处理的事项。
      </AppEmptyState>

      <ol v-else class="grid h-full min-h-0 gap-2 overflow-y-auto pr-1">
        <li
          v-for="item in visibleActions"
          :key="item.key"
          class="list-none"
        >
          <button
            type="button"
            class="w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 text-left transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
            :class="activeKey === item.key ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : undefined"
            @click="emit('select', item)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <span :class="getToneClassName(item.tone)">
                    {{ getToneLabel(item.tone) }}
                  </span>
                  <p class="truncate text-sm font-medium text-(--dashboard-text)">
                    {{ item.title }}
                  </p>
                </div>
                <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
                  {{ item.meta }}
                </p>
              </div>
              <span
                v-if="item.value"
                class="whitespace-nowrap text-sm font-medium text-(--dashboard-accent)"
              >
                {{ item.value }}
              </span>
            </div>
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>
