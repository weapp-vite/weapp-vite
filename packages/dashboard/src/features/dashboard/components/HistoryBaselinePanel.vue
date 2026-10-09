<script setup lang="ts">
import type { AnalyzeComparisonMode, AnalyzeHistorySnapshot } from '../types'
import { computed } from 'vue'
import { formatBytes } from '../utils/format'
import AppSelect from './AppSelect.vue'

const props = defineProps<{
  snapshots: AnalyzeHistorySnapshot[]
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
}>()

const emit = defineEmits<{
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
}>()

const selectedValue = computed(() => props.comparisonMode === 'baseline' && props.baselineSnapshotId
  ? `snapshot:${props.baselineSnapshotId}`
  : 'previous')
const options = computed(() => [
  { value: 'previous', label: '上次构建' },
  ...props.snapshots.map(snapshot => ({
    value: `snapshot:${snapshot.id}`,
    label: `${new Date(snapshot.capturedAt).toLocaleString('zh-CN', { hour12: false })} · ${formatBytes(snapshot.totalBytes)}`,
  })),
])

function selectBaseline(value: string) {
  if (value === 'previous') {
    emit('setComparisonMode', 'previous')
  }
  else {
    emit('setBaseline', value.slice('snapshot:'.length))
  }
}
</script>

<template>
  <AppSelect
    class="w-full max-w-72"
    label="对照基线"
    variant="toolbar"
    :model-value="selectedValue"
    :options="options"
    @update:model-value="selectBaseline"
  />
</template>
