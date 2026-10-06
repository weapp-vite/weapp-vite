<script setup lang="ts">
import type {
  AnalyzeActionCenterItem,
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeSubpackagesResult,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  LargestFileEntry,
  TreemapModuleNodeMeta,
} from '../types'
import type { DiagnosticEvidence } from '../utils/diagnosticEvidence'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { dashboardAnalyzeRevision, dashboardConnectionStatus } from '../utils/dashboardDevframe'
import { createDiagnosticContext, createDiagnosticEvidence } from '../utils/diagnosticEvidence'
import ActionCenterPanel from './ActionCenterPanel.vue'
import DiagnosticContextPanel from './DiagnosticContextPanel.vue'
import DiagnosticEvidencePanel from './DiagnosticEvidencePanel.vue'
import HistoryBaselinePanel from './HistoryBaselinePanel.vue'

const props = defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
  comparisonResult: AnalyzeSubpackagesResult | null
  duplicateModules: DuplicateModuleEntry[]
  historySnapshots: AnalyzeHistorySnapshot[]
  incrementAttribution: IncrementAttributionEntry[]
  result: AnalyzeSubpackagesResult
  selectedActionKey: string | null
}>()

const emit = defineEmits<{
  focusAction: [item: AnalyzeActionCenterItem]
  openFile: [item: LargestFileEntry]
  openSource: [meta: TreemapModuleNodeMeta]
  selectAction: [item: AnalyzeActionCenterItem]
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
}>()

const contextTrigger = useTemplateRef<HTMLButtonElement>('contextTrigger')
const contextText = shallowRef('')
const contextOpen = shallowRef(false)
const contextChanged = shallowRef(false)
const contextVersion = shallowRef(0)
const contextEvidence = shallowRef<DiagnosticEvidence | null>(null)
const contextTitle = shallowRef('')
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
const classificationLabel = computed(() => evidence.value
  ? { problem: '超出预算', risk: '预算风险', clue: '待查线索', unknown: '测量不完整' }[evidence.value.classification]
  : '')
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
  contextEvidence.value = evidence.value
  contextTitle.value = selectedAction.value.title
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
  <section class="grid min-w-0 content-start gap-5" aria-label="问题与证据">
    <DiagnosticEvidencePanel
      :action="selectedAction"
      :evidence="evidence"
      :comparison-label="comparisonLabel"
      @open-file="emit('openFile', $event)"
      @open-source="emit('openSource', $event)"
      @inspect="emit('selectAction', $event)"
    >
      <template #index>
        <slot name="overview" />
        <div class="mt-5 border-t border-(--dashboard-border) pt-5">
          <ActionCenterPanel :actions="actionItems" :active-key="selectedAction?.key ?? null" @select="emit('focusAction', $event)" />
        </div>
        <p class="mt-4 text-xs text-(--dashboard-text-soft)">
          当前报告<span v-if="dashboardAnalyzeRevision !== null"> · R{{ dashboardAnalyzeRevision }}</span>
        </p>
      </template>
      <template #controls>
        <HistoryBaselinePanel
          :snapshots="historySnapshots"
          :baseline-snapshot-id="baselineSnapshotId"
          :comparison-mode="comparisonMode"
          @set-baseline="emit('setBaseline', $event)"
          @set-comparison-mode="emit('setComparisonMode', $event)"
        />
      </template>
      <template v-if="selectedAction" #heading>
        <header class="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 basis-72">
            <p class="mb-1 text-xs text-(--dashboard-text-soft)">{{ classificationLabel }}</p>
            <h2 class="text-xl font-semibold leading-snug tracking-tight text-(--dashboard-text) [overflow-wrap:anywhere]">{{ selectedAction.title }}</h2>
          </div>
          <button
            ref="contextTrigger"
            type="button"
            :disabled="Boolean(connectionReason)"
            :aria-expanded="contextOpen"
            aria-controls="diagnostic-ai-context"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-(--dashboard-accent) px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full dark:text-slate-950"
            @click="prepareContext"
          >
            {{ contextOpen && contextInvalidReason ? '重新准备处理计划' : '查看处理计划' }}
            <span class="icon-[mdi--arrow-down] size-4 shrink-0" aria-hidden="true" />
          </button>
        </header>
        <p v-if="connectionReason" role="status" class="text-sm text-(--dashboard-text-muted)">{{ connectionReason }}</p>
      </template>
      <template #plan="{ showVerification }">
        <DiagnosticContextPanel
          v-if="contextOpen && contextEvidence"
          id="diagnostic-ai-context"
          :key="contextVersion"
          :text="contextText"
          :evidence="contextEvidence"
          :title="contextTitle"
          :invalid-reason="contextInvalidReason"
          @close="closeContext"
          @verification="contextOpen = false; showVerification()"
        />
      </template>
    </DiagnosticEvidencePanel>
  </section>
</template>
