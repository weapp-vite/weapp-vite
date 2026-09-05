<script setup lang="ts">
import type {
  AnalyzeActionCenterItem,
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeWorkQueueItem,
} from '../types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ActionCenterPanel from './ActionCenterPanel.vue'
import AnalyzeWorkQueuePanel from './AnalyzeWorkQueuePanel.vue'
import HistoryBaselinePanel from './HistoryBaselinePanel.vue'

defineProps<{
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

const splitRoot = ref<HTMLElement | null>(null)
const splitPercent = ref(66)
const splitMaxPercent = ref(76)
const activeSideTab = ref<DiagnosticsSideTab>('work-queue')
const splitStyle = computed(() => ({
  '--diagnostics-primary': `${splitPercent.value}%`,
}))
let stopResize: (() => void) | null = null
let splitResizeObserver: ResizeObserver | null = null

function setSplitPercent(value: number) {
  splitPercent.value = Math.min(splitMaxPercent.value, Math.max(52, Math.round(value)))
}

function handleResizePointerDown(event: PointerEvent) {
  if (event.button !== 0 || !splitRoot.value) {
    return
  }
  event.preventDefault()
  const root = splitRoot.value
  const update = (clientX: number) => {
    const bounds = root.getBoundingClientRect()
    setSplitPercent(((clientX - bounds.left) / bounds.width) * 100)
  }
  const handlePointerMove = (moveEvent: PointerEvent) => update(moveEvent.clientX)
  const handlePointerUp = () => stopResize?.()
  stopResize?.()
  stopResize = () => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)
    stopResize = null
  }
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerUp)
  update(event.clientX)
}

function handleResizeKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    setSplitPercent(splitPercent.value - 4)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    setSplitPercent(splitPercent.value + 4)
  }
  else if (event.key === 'Home') {
    event.preventDefault()
    setSplitPercent(52)
  }
  else if (event.key === 'End') {
    event.preventDefault()
    setSplitPercent(splitMaxPercent.value)
  }
}

function updateSplitBounds() {
  const width = splitRoot.value?.clientWidth ?? 0
  if (width === 0) {
    return
  }
  const minimumSideWidth = 320
  const separatorAndGapsWidth = 28
  splitMaxPercent.value = Math.min(
    76,
    Math.max(52, Math.floor(((width - minimumSideWidth - separatorAndGapsWidth) / width) * 100)),
  )
  setSplitPercent(splitPercent.value)
}

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

onMounted(() => {
  splitResizeObserver = new ResizeObserver(updateSplitBounds)
  if (splitRoot.value) {
    splitResizeObserver.observe(splitRoot.value)
  }
  updateSplitBounds()
})

onBeforeUnmount(() => {
  stopResize?.()
  splitResizeObserver?.disconnect()
})
</script>

<template>
  <section
    ref="splitRoot"
    class="diagnostics-split"
    :style="splitStyle"
  >
    <div class="min-h-0 min-w-0 xl:h-full xl:overflow-hidden">
      <ActionCenterPanel
        :actions="actionItems"
        :active-key="selectedActionKey"
        :queued-action-keys="queuedActionKeys"
        @add-to-queue="emit('addActionToQueue', $event)"
        @copy-report="emit('copyPr')"
        @select="emit('selectAction', $event)"
      />
    </div>

    <button
      class="group hidden min-h-0 cursor-col-resize items-center justify-center rounded-md outline-none xl:flex focus-visible:ring-2 focus-visible:ring-(--dashboard-accent)"
      type="button"
      role="separator"
      aria-label="调整问题中心和诊断侧栏宽度"
      aria-orientation="vertical"
      aria-valuemin="52"
      :aria-valuemax="splitMaxPercent"
      :aria-valuenow="splitPercent"
      @keydown="handleResizeKeydown"
      @pointerdown="handleResizePointerDown"
    >
      <span class="h-12 w-0.5 rounded-full bg-(--dashboard-border-strong) transition group-hover:bg-(--dashboard-accent)" />
    </button>

    <div class="grid min-h-0 min-w-0 gap-2 overflow-visible xl:h-full xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
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
  </section>
</template>

<style scoped>
.diagnostics-split {
  display: grid;
  gap: 0.5rem;
  align-items: start;
  min-width: 0;
  min-height: 0;
  overflow: visible;
}

@media (min-width: 1280px) {
  .diagnostics-split {
    grid-template-columns:
      minmax(32rem, var(--diagnostics-primary))
      0.75rem
      minmax(20rem, 1fr);
    align-items: stretch;
    height: 100%;
    overflow: hidden;
  }
}
</style>
