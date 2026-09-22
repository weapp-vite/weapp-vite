<script setup lang="ts">
import AppSelect from './AppSelect.vue'

type HistorySnapshotSortMode = 'capturedAt' | 'total' | 'compressed' | 'modules' | 'duplicates'

defineProps<{
  filteredCount: number
  totalCount: number
  actionStatus: string
  disabled: boolean
}>()

const emit = defineEmits<{
  copy: []
  exportJson: []
}>()

const sortMode = defineModel<HistorySnapshotSortMode>({ required: true })

const sortOptions = [
  { label: '按时间', value: 'capturedAt' },
  { label: '按体积', value: 'total' },
  { label: '按压缩后', value: 'compressed' },
  { label: '按模块数', value: 'modules' },
  { label: '按复用模块', value: 'duplicates' },
] satisfies Array<{ label: string, value: HistorySnapshotSortMode }>
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <p class="text-xs text-(--dashboard-text-soft)">
      匹配 {{ filteredCount }} / {{ totalCount }} 个快照
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="actionStatus" class="text-xs font-medium text-(--dashboard-accent)">
        {{ actionStatus }}
      </span>
      <button
        type="button"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
        :disabled="disabled"
        @click="emit('copy')"
      >
        复制基线
      </button>
      <button
        type="button"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
        :disabled="disabled"
        @click="emit('exportJson')"
      >
        导出 JSON
      </button>
      <AppSelect
        v-model="sortMode"
        class="w-30"
        label="排序历史基线"
        :options="sortOptions"
      />
    </div>
  </div>
</template>
