<script setup lang="ts">
import type { AnalyzeWorkQueueItem } from '../types'
import { computed, ref } from 'vue'
import { runtimeBadgeStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import DashboardIcon from './DashboardIcon.vue'

type WorkQueueFilter = 'open' | 'done' | 'all'

const props = defineProps<{
  items: AnalyzeWorkQueueItem[]
  activeId: string | null
}>()

const emit = defineEmits<{
  clearCompleted: []
  copy: []
  remove: [id: string]
  select: [item: AnalyzeWorkQueueItem]
  toggle: [id: string]
}>()

const queueFilter = ref<WorkQueueFilter>('open')

const openCount = computed(() => props.items.filter(item => !item.completedAt).length)
const doneCount = computed(() => props.items.length - openCount.value)
const visibleItems = computed(() => props.items.filter((item) => {
  if (queueFilter.value === 'open') {
    return !item.completedAt
  }
  if (queueFilter.value === 'done') {
    return Boolean(item.completedAt)
  }
  return true
}))

function getToneClassName(tone: AnalyzeWorkQueueItem['tone']) {
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
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
    <AppPanelHeader icon-name="metric-bookmark" title="处理清单">
      <template #meta>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
          :disabled="items.length === 0"
          @click="emit('copy')"
        >
          <span class="h-3.5 w-3.5">
            <DashboardIcon name="metric-copy" />
          </span>
          复制
        </button>
      </template>
    </AppPanelHeader>

    <div class="mt-3 grid gap-2">
      <div class="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          class="rounded-md border px-2 py-2 text-xs transition"
          :class="queueFilter === 'open' ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft) text-(--dashboard-text)' : 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-soft) hover:border-(--dashboard-border-strong)'"
          @click="queueFilter = 'open'"
        >
          待处理 {{ openCount }}
        </button>
        <button
          type="button"
          class="rounded-md border px-2 py-2 text-xs transition"
          :class="queueFilter === 'done' ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft) text-(--dashboard-text)' : 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-soft) hover:border-(--dashboard-border-strong)'"
          @click="queueFilter = 'done'"
        >
          已完成 {{ doneCount }}
        </button>
        <button
          type="button"
          class="rounded-md border px-2 py-2 text-xs transition"
          :class="queueFilter === 'all' ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft) text-(--dashboard-text)' : 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-soft) hover:border-(--dashboard-border-strong)'"
          @click="queueFilter = 'all'"
        >
          全部 {{ items.length }}
        </button>
      </div>
      <button
        v-if="doneCount > 0"
        type="button"
        class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-xs text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
        @click="emit('clearCompleted')"
      >
        清空已完成
      </button>
    </div>

    <div class="mt-3 min-h-0 overflow-hidden">
      <AppEmptyState v-if="visibleItems.length === 0" compact>
        当前没有处理事项。
      </AppEmptyState>

      <ol v-else class="grid h-full min-h-0 content-start gap-2 overflow-y-auto pr-1">
        <li
          v-for="item in visibleItems"
          :key="item.id"
          class="grid gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-2.5 transition"
          :class="activeId === item.id ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : undefined"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="min-w-0 text-left"
              @click="emit('select', item)"
            >
              <span :class="getToneClassName(item.tone)">
                {{ item.completedAt ? '完成' : '待处理' }}
              </span>
              <p class="mt-2 truncate text-sm font-medium text-(--dashboard-text)">
                {{ item.title }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs leading-5 text-(--dashboard-text-soft)">
                {{ item.meta }}
              </p>
            </button>
            <span v-if="item.value" class="shrink-0 text-xs font-medium text-(--dashboard-accent)">
              {{ item.value }}
            </span>
          </div>
          <div class="flex items-center justify-between gap-2 border-t border-(--dashboard-border) pt-2">
            <button
              type="button"
              class="rounded-full border border-(--dashboard-border) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
              @click="emit('toggle', item.id)"
            >
              {{ item.completedAt ? '重新打开' : '标记完成' }}
            </button>
            <button
              type="button"
              class="rounded-full border border-(--dashboard-border) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-rose-300 hover:text-rose-500"
              @click="emit('remove', item.id)"
            >
              移除
            </button>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
