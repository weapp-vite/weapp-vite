<script setup lang="ts">
import type { PackageType } from '../types'
import { formatPackageType } from '../utils/format'

type PackageFilterType = 'all' | PackageType
type PackageBudgetFilter = 'all' | 'warning' | 'normal'
type PackageSortMode = 'health' | 'size' | 'compressed' | 'delta' | 'duplicates' | 'files' | 'name'

defineProps<{
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
      <select
        v-model="typeFilter"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
      >
        <option value="all">
          全部类型
        </option>
        <option
          v-for="type in typeOptions"
          :key="type"
          :value="type"
        >
          {{ formatPackageType(type) }}
        </option>
      </select>
      <select
        v-model="budgetFilter"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
      >
        <option value="all">
          全部预算
        </option>
        <option value="warning">
          仅告警
        </option>
        <option value="normal">
          预算正常
        </option>
      </select>
      <select
        v-model="sortMode"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
      >
        <option value="health">
          按健康分
        </option>
        <option value="size">
          按体积
        </option>
        <option value="compressed">
          按压缩后
        </option>
        <option value="delta">
          按增量
        </option>
        <option value="duplicates">
          按重复模块
        </option>
        <option value="files">
          按产物数
        </option>
        <option value="name">
          按名称
        </option>
      </select>
    </div>
  </div>
</template>
