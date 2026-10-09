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
import { computed } from 'vue'
import { dashboardAnalyzeRevision } from '../utils/dashboardDevframe'
import { createDiagnosticEvidence } from '../utils/diagnosticEvidence'
import { formatModuleIdentifier } from '../utils/format'
import ActionCenterPanel from './ActionCenterPanel.vue'
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

const selectedAction = computed(() => props.actionItems.find(item => item.key === props.selectedActionKey) ?? props.actionItems[0])
const selectedTarget = computed(() => formatModuleIdentifier(selectedAction.value?.targetLabel ?? ''))
const selectedName = computed(() => selectedTarget.value.slice(selectedTarget.value.lastIndexOf('/') + 1))
const selectedKindLabel = computed(() => selectedAction.value
  ? { budget: '预算', increment: '增长', duplicate: '重复' }[selectedAction.value.kind]
  : '')
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
const primaryArtifact = computed(() => evidence.value?.artifacts[0]?.entry ?? null)
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
        <div class="mt-1.5 border-t border-(--dashboard-border) pt-1.5">
          <ActionCenterPanel :actions="actionItems" :active-key="selectedAction?.key ?? null" @select="emit('focusAction', $event)" />
        </div>
        <p class="mt-3 text-xs text-(--dashboard-text-soft)">
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
          <div class="min-w-0 flex-1 basis-64">
            <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h2 data-diagnostic-object class="min-w-0 font-mono text-base font-semibold leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ selectedName }}</h2>
              <span class="rounded-sm border border-(--dashboard-border) px-1.5 py-0.5 text-xs text-(--dashboard-text-muted)">{{ selectedKindLabel }} · {{ classificationLabel }}</span>
            </div>
            <p v-if="selectedTarget !== selectedName" data-diagnostic-object-path class="mt-1 font-mono text-xs leading-5 text-(--dashboard-text-soft) [overflow-wrap:anywhere]">{{ selectedTarget }}</p>
          </div>
          <button
            v-if="primaryArtifact"
            type="button"
            class="inline-flex min-h-11 items-center justify-center rounded-lg border border-(--dashboard-border) px-3 text-sm font-medium text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted)"
            @click="emit('openFile', primaryArtifact)"
          >
            检查关联对象
          </button>
        </header>
      </template>
    </DiagnosticEvidencePanel>
  </section>
</template>
