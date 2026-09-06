<script setup lang="ts">
import type { PackageType } from '../types'
import { computed } from 'vue'
import { formatPackageType } from '../utils/format'
import AppSelect from './AppSelect.vue'

type PackageFilterType = 'all' | PackageType
type PackageBudgetFilter = 'all' | 'warning' | 'normal'
type PackageSortMode = 'health' | 'size' | 'compressed' | 'delta' | 'duplicates' | 'files' | 'name'

const props = defineProps<{
  filteredCount: number
  totalCount: number
  typeOptions: PackageType[]
  actionStatus: string
  disabled: boolean
}>()

const emit = defineEmits<{
  copy: []
  exportJson: []
}>()

const query = defineModel<string>('query', { required: true })
const typeFilter = defineModel<PackageFilterType>('typeFilter', { required: true })
const budgetFilter = defineModel<PackageBudgetFilter>('budgetFilter', { required: true })
const sortMode = defineModel<PackageSortMode>('sortMode', { required: true })

const typeFilterOptions = computed(() => [
  { label: '全部类型', value: 'all' as const },
  ...props.typeOptions.map(type => ({
    label: formatPackageType(type),
    value: type,
  })),
])
const budgetFilterOptions = [
  { label: '全部预算', value: 'all' },
  { label: '仅告警', value: 'warning' },
  { label: '预算正常', value: 'normal' },
] satisfies Array<{ label: string, value: PackageBudgetFilter }>
const sortOptions = [
  { label: '按健康分', value: 'health' },
  { label: '按体积', value: 'size' },
  { label: '按压缩后', value: 'compressed' },
  { label: '按增量', value: 'delta' },
  { label: '按重复模块', value: 'duplicates' },
  { label: '按产物数', value: 'files' },
  { label: '按名称', value: 'name' },
] satisfies Array<{ label: string, value: PackageSortMode }>
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <p class="text-xs font-medium text-(--dashboard-text-soft)">
        匹配 {{ filteredCount }} / {{ totalCount }} 个包
      </p>
      <p v-if="actionStatus" class="mt-1 text-xs font-medium text-(--dashboard-accent)">
        {{ actionStatus }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
        :disabled="disabled"
        @click="emit('copy')"
      >
        复制包体
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
        placeholder="搜索包名或类型"
        type="search"
      >
      <AppSelect
        v-model="typeFilter"
        class="w-28"
        label="筛选包类型"
        :options="typeFilterOptions"
      />
      <AppSelect
        v-model="budgetFilter"
        class="w-28"
        label="筛选包预算状态"
        :options="budgetFilterOptions"
      />
      <AppSelect
        v-model="sortMode"
        class="w-32"
        label="排序包"
        :options="sortOptions"
      />
    </div>
  </div>
</template>
