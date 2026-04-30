<script setup lang="ts">
import type { ModuleSourceType } from '../types'

type DuplicateModuleSourceFilter = 'all' | ModuleSourceType
type DuplicateModuleSortMode = 'saving' | 'packages' | 'size' | 'source'

defineProps<{
  filteredCount: number
  totalCount: number
  sourceOptions: ModuleSourceType[]
  actionStatus: string
  disabled: boolean
}>()

const emit = defineEmits<{
  copy: []
  exportJson: []
}>()

const query = defineModel<string>('query', { required: true })
const sourceFilter = defineModel<DuplicateModuleSourceFilter>('sourceFilter', { required: true })
const sortMode = defineModel<DuplicateModuleSortMode>('sortMode', { required: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-xs font-medium text-(--dashboard-text-soft)">
      匹配 {{ filteredCount }} / {{ totalCount }}
    </span>
    <span v-if="actionStatus" class="text-xs font-medium text-(--dashboard-accent)">
      {{ actionStatus }}
    </span>
    <button
      type="button"
      class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
      :disabled="disabled"
      @click="emit('copy')"
    >
      复制重复模块
    </button>
    <button
      type="button"
      class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
      :disabled="disabled"
      @click="emit('exportJson')"
    >
      导出 JSON
    </button>
    <input
      v-model="query"
      class="h-9 w-56 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text) outline-none transition placeholder:text-(--dashboard-text-soft) focus:border-(--dashboard-accent)"
      placeholder="搜索模块、包或文件"
      type="search"
    >
    <select
      v-model="sourceFilter"
      class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
    >
      <option value="all">
        全部来源
      </option>
      <option
        v-for="sourceType in sourceOptions"
        :key="sourceType"
        :value="sourceType"
      >
        {{ sourceType }}
      </option>
    </select>
    <select
      v-model="sortMode"
      class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
    >
      <option value="saving">
        按可节省
      </option>
      <option value="packages">
        按包数量
      </option>
      <option value="size">
        按单份体积
      </option>
      <option value="source">
        按路径
      </option>
    </select>
  </div>
</template>
