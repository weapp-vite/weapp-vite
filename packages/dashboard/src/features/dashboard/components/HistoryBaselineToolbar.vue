<script setup lang="ts">
import AppSelect from './AppSelect.vue'
import AppToolButton from './AppToolButton.vue'

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
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <span v-if="actionStatus" class="text-xs font-medium text-(--dashboard-accent)">
        {{ actionStatus }}
      </span>
      <div class="flex shrink-0 flex-nowrap items-center gap-2">
        <AppToolButton
          label="复制历史基线"
          icon-name="metric-copy"
          touch-label="复制"
          :disabled="disabled"
          @click="emit('copy')"
        />
        <AppToolButton
          label="导出历史基线 JSON"
          icon-name="metric-entries"
          touch-label="导出"
          :disabled="disabled"
          @click="emit('exportJson')"
        />
      </div>
      <AppSelect
        v-model="sortMode"
        class="w-30"
        label="排序历史基线"
        :options="sortOptions"
      />
    </div>
  </div>
</template>
