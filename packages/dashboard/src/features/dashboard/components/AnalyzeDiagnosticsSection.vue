<script setup lang="ts">
import type {
  AnalyzeActionCenterItem,
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeWorkQueueItem,
} from '../types'
import ActionCenterPanel from './ActionCenterPanel.vue'
import AnalyzeDraggableGrid from './AnalyzeDraggableGrid.vue'
import AnalyzeWorkQueuePanel from './AnalyzeWorkQueuePanel.vue'
import HistoryBaselinePanel from './HistoryBaselinePanel.vue'

defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  activeWorkQueueItemId: string | null
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
  historySnapshots: AnalyzeHistorySnapshot[]
  layoutItems: Array<{ id: string, label: string }>
  queuedActionKeys: string[]
  selectedActionKey: string | null
  workQueueItems: AnalyzeWorkQueueItem[]
}>()

const emit = defineEmits<{
  addActionToQueue: [item: AnalyzeActionCenterItem]
  clearCompletedWorkQueue: []
  copyPr: []
  copyWorkQueue: []
  removeWorkQueueItem: [id: string]
  selectAction: [item: AnalyzeActionCenterItem]
  selectWorkQueueItem: [item: AnalyzeWorkQueueItem]
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
  toggleWorkQueueItem: [id: string]
}>()
</script>

<template>
  <AnalyzeDraggableGrid
    grid-class="grid h-full min-h-0 gap-2 overflow-y-auto pr-1 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.38fr)_minmax(20rem,0.38fr)] xl:overflow-hidden xl:pr-0"
    :items="layoutItems"
    storage-key="weapp-vite:dashboard:analyze-layout:diagnostics"
  >
    <template #actions>
      <ActionCenterPanel
        :actions="actionItems"
        :active-key="selectedActionKey"
        :queued-action-keys="queuedActionKeys"
        @add-to-queue="emit('addActionToQueue', $event)"
        @copy-report="emit('copyPr')"
        @select="emit('selectAction', $event)"
      />
    </template>
    <template #work-queue>
      <AnalyzeWorkQueuePanel
        :items="workQueueItems"
        :active-id="activeWorkQueueItemId"
        @clear-completed="emit('clearCompletedWorkQueue')"
        @copy="emit('copyWorkQueue')"
        @remove="emit('removeWorkQueueItem', $event)"
        @select="emit('selectWorkQueueItem', $event)"
        @toggle="emit('toggleWorkQueueItem', $event)"
      />
    </template>
    <template #history>
      <HistoryBaselinePanel
        :snapshots="historySnapshots"
        :baseline-snapshot-id="baselineSnapshotId"
        :comparison-mode="comparisonMode"
        @set-baseline="emit('setBaseline', $event)"
        @set-comparison-mode="emit('setComparisonMode', $event)"
      />
    </template>
  </AnalyzeDraggableGrid>
</template>
