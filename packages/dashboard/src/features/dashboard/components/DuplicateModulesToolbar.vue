<script setup lang="ts">
import type { ModuleSourceType } from '../types'
import { computed } from 'vue'
import AppSelect from './AppSelect.vue'

type DuplicateModuleSourceFilter = 'all' | ModuleSourceType
type DuplicateModuleSortMode = 'saving' | 'packages' | 'size' | 'source'

const props = defineProps<{
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

const sourceFilterOptions = computed(() => [
  { label: '全部来源', value: 'all' as const },
  ...props.sourceOptions.map(sourceType => ({
    label: sourceType,
    value: sourceType,
  })),
])
const sortOptions = [
  { label: '按可节省', value: 'saving' },
  { label: '按包数量', value: 'packages' },
  { label: '按单份体积', value: 'size' },
  { label: '按路径', value: 'source' },
] satisfies Array<{ label: string, value: DuplicateModuleSortMode }>
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
    <AppSelect
      v-model="sourceFilter"
      class="w-28"
      label="筛选重复模块来源"
      :options="sourceFilterOptions"
    />
    <AppSelect
      v-model="sortMode"
      class="w-30"
      label="排序重复模块"
      :options="sortOptions"
    />
  </div>
</template>
