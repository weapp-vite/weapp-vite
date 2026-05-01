<script setup lang="ts">
import type { AnalyzeActionCenterItem } from '../types'
import { useActionCenterPanel } from '../composables/useActionCenterPanel'
import { surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  actions: AnalyzeActionCenterItem[]
  activeKey: string | null
  queuedActionKeys: string[]
}>()

const emit = defineEmits<{
  addToQueue: [item: AnalyzeActionCenterItem]
  copyReport: []
  select: [item: AnalyzeActionCenterItem]
}>()

const {
  actionKindFilter,
  actionQuery,
  actionSortMode,
  actionToneFilter,
  filteredActions,
  getKindLabel,
  getToneClassName,
  getToneLabel,
  isQueued,
  kindOptions,
  toneOptions,
} = useActionCenterPanel(props)
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
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

    <div class="mt-3 grid gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-(--dashboard-text-soft)">
          匹配 {{ filteredActions.length }} / {{ actions.length }} 个处理项
        </p>
        <input
          v-model="actionQuery"
          class="h-9 w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text) outline-none transition placeholder:text-(--dashboard-text-soft) focus:border-(--dashboard-accent) md:w-64"
          placeholder="搜索问题、建议或目标页"
          type="search"
        >
      </div>
      <div class="grid grid-cols-3 gap-2">
        <select
          v-model="actionToneFilter"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="all">
            全部严重度
          </option>
          <option
            v-for="tone in toneOptions"
            :key="tone"
            :value="tone"
          >
            {{ getToneLabel(tone) }}
          </option>
        </select>
        <select
          v-model="actionKindFilter"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="all">
            全部类型
          </option>
          <option
            v-for="kind in kindOptions"
            :key="kind"
            :value="kind"
          >
            {{ getKindLabel(kind) }}
          </option>
        </select>
        <select
          v-model="actionSortMode"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="priority">
            按优先级
          </option>
          <option value="severity">
            按严重度
          </option>
          <option value="title">
            按标题
          </option>
          <option value="value">
            按数值
          </option>
        </select>
      </div>
    </div>

    <div class="mt-3 min-h-0 overflow-hidden">
      <AppEmptyState v-if="filteredActions.length === 0" compact>
        暂无匹配当前筛选条件的事项。
      </AppEmptyState>

      <ol v-else class="grid h-full min-h-0 content-start gap-2 overflow-y-auto pr-1">
        <li
          v-for="item in filteredActions"
          :key="item.key"
          class="list-none"
        >
          <article
            class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
            :class="activeKey === item.key ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : undefined"
          >
            <div class="flex items-start justify-between gap-3">
              <button
                type="button"
                class="min-w-0 text-left"
                @click="emit('select', item)"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <span :class="getToneClassName(item.tone)">
                    {{ getToneLabel(item.tone) }}
                  </span>
                  <span class="rounded-full bg-(--dashboard-accent-soft) px-2 py-0.5 text-[11px] text-(--dashboard-text-muted)">
                    {{ getKindLabel(item.kind) }}
                  </span>
                  <p class="truncate text-sm font-medium text-(--dashboard-text)">
                    {{ item.title }}
                  </p>
                </div>
                <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
                  {{ item.meta }}
                </p>
              </button>
              <span
                v-if="item.value"
                class="whitespace-nowrap text-sm font-medium text-(--dashboard-accent)"
              >
                {{ item.value }}
              </span>
            </div>
            <div class="mt-2 flex items-center justify-end border-t border-(--dashboard-border) pt-2">
              <button
                type="button"
                class="rounded-full border border-(--dashboard-border) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text) disabled:cursor-not-allowed disabled:opacity-55"
                :disabled="isQueued(item)"
                @click="emit('addToQueue', item)"
              >
                {{ isQueued(item) ? '已在清单' : '加入清单' }}
              </button>
            </div>
          </article>
        </li>
      </ol>
    </div>
  </section>
</template>
