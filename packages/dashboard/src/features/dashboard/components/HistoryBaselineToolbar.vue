<script setup lang="ts">
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
      <select
        v-model="sortMode"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
      >
        <option value="capturedAt">
          按时间
        </option>
        <option value="total">
          按体积
        </option>
        <option value="compressed">
          按压缩后
        </option>
        <option value="modules">
          按模块数
        </option>
        <option value="duplicates">
          按复用模块
        </option>
      </select>
    </div>
  </div>
</template>
