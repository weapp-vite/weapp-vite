<script setup lang="ts">
import type {
  AnalyzeActionCenterItem,
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeWorkQueueItem,
} from '../types'
import { shallowRef, useId, watch } from 'vue'
import ActionCenterPanel from './ActionCenterPanel.vue'
import AnalyzeWorkQueuePanel from './AnalyzeWorkQueuePanel.vue'
import HistoryBaselinePanel from './HistoryBaselinePanel.vue'

const props = defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  activeWorkQueueItemId: string | null
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
  historySnapshots: AnalyzeHistorySnapshot[]
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

type DiagnosticsSideTab = 'work-queue' | 'history'

const toolsId = useId()
const toolsOpen = shallowRef(Boolean(props.activeWorkQueueItemId) || props.comparisonMode === 'baseline')
const activeSideTab = shallowRef<DiagnosticsSideTab>(
  !props.activeWorkQueueItemId && props.comparisonMode === 'baseline' ? 'history' : 'work-queue',
)

watch(() => props.activeWorkQueueItemId, (id) => {
  if (id) {
    toolsOpen.value = true
    activeSideTab.value = 'work-queue'
  }
})

watch(() => props.comparisonMode, (mode) => {
  if (mode === 'baseline') {
    toolsOpen.value = true
    activeSideTab.value = 'history'
  }
})

function setActiveSideTab(tab: DiagnosticsSideTab, focus = false) {
  activeSideTab.value = tab
  if (focus) {
    document.getElementById(`diagnostics-${tab}-tab`)?.focus()
  }
}

function handleSideTabKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' || event.key === 'Home') {
    event.preventDefault()
    setActiveSideTab('work-queue', true)
  }
  else if (event.key === 'ArrowRight' || event.key === 'End') {
    event.preventDefault()
    setActiveSideTab('history', true)
  }
}
</script>

<template>
  <section class="grid min-h-0 min-w-0 content-start gap-3">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <span v-if="comparisonMode === 'baseline'" class="text-sm text-(--dashboard-text-muted)">
        正在与所选基线对比
      </span>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)"
        :aria-expanded="toolsOpen"
        :aria-controls="toolsId"
        @click="toolsOpen = !toolsOpen"
      >
        <span class="icon-[mdi--chevron-right] size-4 shrink-0" :class="{ 'rotate-90': toolsOpen }" aria-hidden="true" />
        处理清单与历史对比
        <span v-if="workQueueItems.length" class="tabular-nums">（{{ workQueueItems.length }} 项）</span>
      </button>
    </div>

    <div class="grid min-w-0 items-start gap-4" :class="toolsOpen ? 'xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]' : undefined">
      <div class="min-h-0 min-w-0">
        <ActionCenterPanel
          :actions="actionItems"
          :active-key="selectedActionKey"
          :queued-action-keys="queuedActionKeys"
          @add-to-queue="emit('addActionToQueue', $event)"
          @copy-report="emit('copyPr')"
          @select="emit('selectAction', $event)"
        />
      </div>

      <div v-show="toolsOpen" :id="toolsId" class="grid min-h-0 min-w-0 content-start gap-2">
        <div
          class="grid grid-cols-2 rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-1"
          role="tablist"
          aria-label="诊断侧栏"
        >
          <button
            id="diagnostics-work-queue-tab"
            type="button"
            role="tab"
            class="rounded-md px-3 py-2 text-sm font-medium transition"
            :class="activeSideTab === 'work-queue'
              ? 'bg-(--dashboard-accent-soft) text-(--dashboard-accent)'
              : 'text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)'"
            :aria-selected="activeSideTab === 'work-queue'"
            :tabindex="activeSideTab === 'work-queue' ? 0 : -1"
            aria-controls="diagnostics-work-queue-panel"
            @click="setActiveSideTab('work-queue')"
            @keydown="handleSideTabKeydown"
          >
            处理清单
          </button>
          <button
            id="diagnostics-history-tab"
            type="button"
            role="tab"
            class="rounded-md px-3 py-2 text-sm font-medium transition"
            :class="activeSideTab === 'history'
              ? 'bg-(--dashboard-accent-soft) text-(--dashboard-accent)'
              : 'text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)'"
            :aria-selected="activeSideTab === 'history'"
            :tabindex="activeSideTab === 'history' ? 0 : -1"
            aria-controls="diagnostics-history-panel"
            @click="setActiveSideTab('history')"
            @keydown="handleSideTabKeydown"
          >
            历史基线
          </button>
        </div>

        <div class="min-h-0 min-w-0 overflow-visible xl:overflow-hidden">
          <div
            v-show="activeSideTab === 'work-queue'"
            id="diagnostics-work-queue-panel"
            class="h-full min-h-0"
            role="tabpanel"
            aria-labelledby="diagnostics-work-queue-tab"
          >
            <AnalyzeWorkQueuePanel
              :items="workQueueItems"
              :active-id="activeWorkQueueItemId"
              @clear-completed="emit('clearCompletedWorkQueue')"
              @copy="emit('copyWorkQueue')"
              @remove="emit('removeWorkQueueItem', $event)"
              @select="emit('selectWorkQueueItem', $event)"
              @toggle="emit('toggleWorkQueueItem', $event)"
            />
          </div>
          <div
            v-show="activeSideTab === 'history'"
            id="diagnostics-history-panel"
            class="h-full min-h-0"
            role="tabpanel"
            aria-labelledby="diagnostics-history-tab"
          >
            <HistoryBaselinePanel
              :snapshots="historySnapshots"
              :baseline-snapshot-id="baselineSnapshotId"
              :comparison-mode="comparisonMode"
              @set-baseline="emit('setBaseline', $event)"
              @set-comparison-mode="emit('setComparisonMode', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
