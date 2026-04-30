<script setup lang="ts">
import type { WorkspaceActivityItem } from '../types'
import { computed, ref } from 'vue'
import AppEmptyState from './AppEmptyState.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

type ActivityToneFilter = 'all' | WorkspaceActivityItem['tone']

const props = defineProps<{
  items: WorkspaceActivityItem[]
  checklist: string[]
}>()

const searchQuery = ref('')
const toneFilter = ref<ActivityToneFilter>('all')

const toneOptions: Array<{ value: ActivityToneFilter, label: string }> = [
  { value: 'all', label: '全部动态' },
  { value: 'live', label: '实时' },
  { value: 'default', label: '记录' },
]

const filteredItems = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()

  return props.items.filter((item) => {
    if (toneFilter.value !== 'all' && item.tone !== toneFilter.value) {
      return false
    }

    if (!keyword) {
      return true
    }

    return [
      item.time,
      item.title,
      item.summary,
      item.tone,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const activitySummary = computed(() => {
  const toneText = toneFilter.value === 'all'
    ? '全部'
    : toneFilter.value === 'live' ? '实时' : '记录'
  return `匹配 ${filteredItems.value.length} / ${props.items.length} 条 · ${toneText}`
})
</script>

<template>
  <div class="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.58fr)]">
    <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div class="grid gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
        <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_9.5rem]">
          <label class="grid gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-(--dashboard-text-soft)">
            搜索动态
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索标题、摘要或时间"
              class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm normal-case tracking-normal text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
            >
          </label>

          <label class="grid gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-(--dashboard-text-soft)">
            状态
            <select
              v-model="toneFilter"
              class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-2.5 text-sm normal-case tracking-normal text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
            >
              <option
                v-for="option in toneOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <p class="text-xs text-(--dashboard-text-soft)">
          {{ activitySummary }}
        </p>
      </div>

      <AppEmptyState v-if="filteredItems.length === 0" compact>
        当前筛选条件下没有匹配动态。
      </AppEmptyState>

      <ol v-else class="grid min-h-0 gap-2 overflow-y-auto pr-1">
        <li
          v-for="item in filteredItems"
          :key="`${item.time}-${item.title}`"
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft)">
                {{ item.time }}
              </p>
              <h3 class="mt-1 truncate font-medium">
                {{ item.title }}
              </h3>
            </div>
            <AppRuntimeBadge
              :label="item.tone === 'live' ? '实时' : '记录'"
              :tone="item.tone === 'live' ? 'success' : 'neutral'"
            />
          </div>
          <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">
            {{ item.summary }}
          </p>
        </li>
      </ol>
    </div>

    <aside class="grid min-h-0 content-start gap-2 overflow-y-auto rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
      <div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-(--dashboard-accent)">
          Checklist
        </p>
        <h3 class="mt-1 font-semibold">
          发布检查
        </h3>
      </div>
      <ul class="grid gap-2 text-sm leading-6 text-(--dashboard-text-muted)">
        <li
          v-for="item in checklist"
          :key="item"
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2"
        >
          {{ item }}
        </li>
      </ul>
    </aside>
  </div>
</template>
