<script setup lang="ts">
import type { ActivityEventSortMode } from '../types'

defineProps<{
  filteredCount: number
  totalCount: number
}>()

const sortMode = defineModel<ActivityEventSortMode>({ required: true })
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2">
    <p class="text-xs text-(--dashboard-text-soft)">
      匹配 {{ filteredCount }} / {{ totalCount }} 条事件
    </p>
    <select
      v-model="sortMode"
      class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
    >
      <option value="time">
        按时间
      </option>
      <option value="duration">
        按耗时
      </option>
      <option value="severity">
        按等级
      </option>
      <option value="source">
        按来源
      </option>
    </select>
  </div>
</template>
