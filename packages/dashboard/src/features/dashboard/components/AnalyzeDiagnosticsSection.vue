<script setup lang="ts">
import type {
  AnalyzeActionCenterItem,
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeSubpackagesResult,
  AnalyzeWorkQueueItem,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  LargestFileEntry,
  TreemapModuleNodeMeta,
} from '../types'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { dashboardAnalyzeRevision, dashboardConnectionStatus } from '../utils/dashboardDevframe'
import { createDiagnosticContext, createDiagnosticEvidence } from '../utils/diagnosticEvidence'
import ActionCenterPanel from './ActionCenterPanel.vue'
import AnalyzeWorkQueuePanel from './AnalyzeWorkQueuePanel.vue'
import DiagnosticContextPanel from './DiagnosticContextPanel.vue'
import DiagnosticEvidencePanel from './DiagnosticEvidencePanel.vue'
import HistoryBaselinePanel from './HistoryBaselinePanel.vue'

const props = defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  activeWorkQueueItemId: string | null
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
  comparisonResult: AnalyzeSubpackagesResult | null
  duplicateModules: DuplicateModuleEntry[]
  historySnapshots: AnalyzeHistorySnapshot[]
  incrementAttribution: IncrementAttributionEntry[]
  queuedActionKeys: string[]
  result: AnalyzeSubpackagesResult
  selectedActionKey: string | null
  workQueueItems: AnalyzeWorkQueueItem[]
}>()

const emit = defineEmits<{
  addActionToQueue: [item: AnalyzeActionCenterItem]
  clearCompletedWorkQueue: []
  copyWorkQueue: []
  focusAction: [item: AnalyzeActionCenterItem]
  openFile: [item: LargestFileEntry]
  openSource: [meta: TreemapModuleNodeMeta]
  removeWorkQueueItem: [id: string]
  selectAction: [item: AnalyzeActionCenterItem]
  selectWorkQueueItem: [item: AnalyzeWorkQueueItem]
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
  toggleWorkQueueItem: [id: string]
}>()

const contextTrigger = useTemplateRef<HTMLButtonElement>('contextTrigger')
const contextText = shallowRef('')
const contextOpen = shallowRef(false)
const contextChanged = shallowRef(false)
const contextVersion = shallowRef(0)
const selectedAction = computed(() => props.actionItems.find(item => item.key === props.selectedActionKey) ?? props.actionItems[0])
const evidence = computed(() => selectedAction.value
  ? createDiagnosticEvidence({
      action: selectedAction.value,
      result: props.result,
      previous: props.comparisonResult,
      duplicateModules: props.duplicateModules,
      incrementAttribution: props.incrementAttribution,
    })
  : null)
const problemCount = computed(() => props.actionItems.filter(item => item.warning?.status === 'critical').length)
const comparisonLabel = computed(() => !props.comparisonResult
  ? '无历史基线，不推断增长'
  : props.comparisonMode === 'baseline' ? '浏览器选定基线' : '上次构建（浏览器对照）')
const connectionReason = computed(() => dashboardConnectionStatus.value !== 'connected'
  ? '构建报告连接不可用，不能交接旧证据。'
  : dashboardAnalyzeRevision.value === null ? '正在等待完整构建报告。' : '')
const contextInvalidReason = computed(() => connectionReason.value || (contextChanged.value
  ? '报告、对照基线或所选对象已变化，原上下文已失效。'
  : ''))

watch([
  () => props.result,
  () => props.comparisonResult,
  () => props.comparisonMode,
  () => selectedAction.value?.key,
  dashboardAnalyzeRevision,
  dashboardConnectionStatus,
], () => {
  if (contextOpen.value) {
    contextChanged.value = true
  }
}, { flush: 'sync' })

function prepareContext() {
  if (connectionReason.value || !selectedAction.value || !evidence.value) {
    return
  }
  contextText.value = createDiagnosticContext({
    action: selectedAction.value,
    evidence: evidence.value,
    result: props.result,
    previous: props.comparisonResult,
    comparisonMode: props.comparisonMode,
    revision: dashboardAnalyzeRevision.value,
  })
  contextChanged.value = false
  contextVersion.value += 1
  contextOpen.value = true
}

async function closeContext() {
  contextOpen.value = false
  await nextTick()
  contextTrigger.value?.focus()
}
</script>

<template>
  <section class="grid min-w-0 content-start gap-4" aria-label="包体诊断">
    <header class="flex min-w-0 flex-wrap items-end justify-between gap-3">
      <p class="text-sm text-(--dashboard-text-muted)">
        {{ problemCount }} 项超预算 · {{ actionItems.length - problemCount }} 项风险与线索
      </p>
      <div class="min-w-0 text-sm leading-6 text-(--dashboard-text-muted) [overflow-wrap:anywhere]">
        <p>{{ comparisonLabel }}</p>
        <p class="font-mono text-xs">
          报告 {{ result.metadata?.generatedAt ?? '生成时间未提供' }}
          <span v-if="dashboardAnalyzeRevision !== null"> · R{{ dashboardAnalyzeRevision }}</span>
        </p>
      </div>
    </header>

    <div v-if="selectedAction && evidence" class="diagnostic-layout min-w-0 overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel)">
      <div class="diagnostic-columns grid min-w-0 items-start">
        <aside class="diagnostic-index min-w-0 border-b border-(--dashboard-border) p-4 sm:p-5" aria-label="问题与线索索引">
          <ActionCenterPanel
            :actions="actionItems"
            :active-key="selectedAction.key"
            @select="emit('focusAction', $event)"
          />
        </aside>
        <div class="min-w-0">
          <div class="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-(--dashboard-border) p-4 sm:p-5">
            <div class="min-w-0 flex-1 basis-64">
              <h2 class="text-lg font-semibold leading-7 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ selectedAction.title }}</h2>
              <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted) [overflow-wrap:anywhere]">{{ selectedAction.meta }}</p>
            </div>
            <div class="flex min-w-0 flex-col items-start gap-2">
              <button
                ref="contextTrigger"
                type="button"
                :disabled="Boolean(connectionReason)"
                :aria-expanded="contextOpen"
                aria-controls="diagnostic-ai-context"
                class="min-h-11 rounded-md bg-(--dashboard-accent) px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-950"
                @click="prepareContext"
              >
                {{ contextOpen && contextInvalidReason ? '重新准备 AI 上下文' : '准备 AI 诊断上下文' }}
              </button>
              <span class="text-xs text-(--dashboard-text-soft)">只读交接，不会自动修复</span>
            </div>
          </div>
          <p v-if="connectionReason" role="status" class="px-4 pt-3 text-sm text-(--dashboard-text-muted) sm:px-5">{{ connectionReason }}</p>
          <DiagnosticEvidencePanel
            :action="selectedAction"
            :evidence="evidence"
            :comparison-label="comparisonLabel"
            class="p-4 sm:p-5"
            @open-file="emit('openFile', $event)"
            @open-source="emit('openSource', $event)"
            @inspect="emit('selectAction', $event)"
          />
        </div>
      </div>
      <DiagnosticContextPanel
        v-if="contextOpen"
        id="diagnostic-ai-context"
        :key="contextVersion"
        :text="contextText"
        :invalid-reason="contextInvalidReason"
        @close="closeContext"
      />
    </div>
    <div v-else class="rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-6">
      <h3 class="font-semibold text-(--dashboard-text)">当前没有待调查的预算风险或分析线索</h3>
      <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">不把最大文件自动当作问题。需要继续分析时，可查看包体详情或模块复用；构建报告本身不代表运行时已验收。</p>
    </div>

    <details class="group min-w-0 border-t border-(--dashboard-border) pt-2" :open="Boolean(activeWorkQueueItemId) || comparisonMode === 'baseline'">
      <summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm text-(--dashboard-text-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)">
        <span class="icon-[mdi--chevron-right] size-4 shrink-0 group-open:rotate-90" aria-hidden="true" />
        处理清单与历史对比<span v-if="workQueueItems.length">（{{ workQueueItems.length }} 项）</span>
      </summary>
      <div class="grid min-w-0 gap-4 pt-3 xl:grid-cols-2">
        <div class="min-w-0">
          <button v-if="selectedAction" type="button" :disabled="queuedActionKeys.includes(selectedAction.key)" class="mb-3 min-h-11 rounded-md border border-(--dashboard-border) px-3 text-sm text-(--dashboard-text-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) disabled:opacity-50" @click="emit('addActionToQueue', selectedAction)">
            {{ queuedActionKeys.includes(selectedAction.key) ? '当前事项已在清单' : '将当前事项加入清单' }}
          </button>
          <AnalyzeWorkQueuePanel :items="workQueueItems" :active-id="activeWorkQueueItemId" @clear-completed="emit('clearCompletedWorkQueue')" @copy="emit('copyWorkQueue')" @remove="emit('removeWorkQueueItem', $event)" @select="emit('selectWorkQueueItem', $event)" @toggle="emit('toggleWorkQueueItem', $event)" />
        </div>
        <HistoryBaselinePanel :snapshots="historySnapshots" :baseline-snapshot-id="baselineSnapshotId" :comparison-mode="comparisonMode" @set-baseline="emit('setBaseline', $event)" @set-comparison-mode="emit('setComparisonMode', $event)" />
      </div>
    </details>
  </section>
</template>

<style scoped>
.diagnostic-layout {
  container: diagnostics / inline-size;
}

@container diagnostics (min-width: 60rem) {
  .diagnostic-columns {
    grid-template-columns: 20rem minmax(0, 1fr);
  }

  .diagnostic-index {
    border-right: 1px solid var(--dashboard-border);
    border-bottom: 0;
  }
}
</style>
