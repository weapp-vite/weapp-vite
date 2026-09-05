<script setup lang="ts">
import type { AnalyzeActionCenterItem } from '../types'
import { useActionCenterPanel } from '../composables/useActionCenterPanel'
import { surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import AppSelect from './AppSelect.vue'
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
  actionSortOptions,
  actionToneFilter,
  filteredActions,
  getKindLabel,
  getToneClassName,
  getToneLabel,
  isQueued,
  kindFilterOptions,
  toneFilterOptions,
} = useActionCenterPanel(props)
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="grid min-h-0 min-w-0 gap-3 overflow-visible xl:h-full xl:grid-rows-[auto_auto_minmax(0,1fr)] xl:overflow-hidden">
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
      <div class="grid gap-2 md:grid-cols-3">
        <AppSelect
          v-model="actionToneFilter"
          label="按严重度筛选"
          :options="toneFilterOptions"
        />
        <AppSelect
          v-model="actionKindFilter"
          label="按问题类型筛选"
          :options="kindFilterOptions"
        />
        <AppSelect
          v-model="actionSortMode"
          label="排序处理项"
          :options="actionSortOptions"
        />
      </div>
    </div>

    <div class="mt-3 max-h-[36rem] min-h-0 overflow-y-auto xl:max-h-none xl:overflow-hidden">
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
            <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <button
                type="button"
                class="min-w-0 text-left"
                @click="emit('select', item)"
              >
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <span :class="getToneClassName(item.tone)">
                    {{ getToneLabel(item.tone) }}
                  </span>
                  <span class="shrink-0 whitespace-nowrap rounded-full bg-(--dashboard-accent-soft) px-2 py-0.5 text-[11px] text-(--dashboard-text-muted)">
                    {{ getKindLabel(item.kind) }}
                  </span>
                </div>
                <p class="mt-2 line-clamp-2 break-words text-sm font-medium leading-5 text-(--dashboard-text)">
                  {{ item.title }}
                </p>
                <p class="mt-1 line-clamp-2 break-words text-xs leading-5 text-(--dashboard-text-soft)">
                  {{ item.meta }}
                </p>
              </button>
              <span
                v-if="item.value"
                class="max-w-28 shrink-0 truncate text-sm font-medium text-(--dashboard-accent)"
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
