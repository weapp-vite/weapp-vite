<script setup lang="ts">
import type { AnalyzeActionCenterItem, LargestFileEntry, TreemapModuleNodeMeta } from '../types'
import type { DiagnosticEvidence } from '../utils/diagnosticEvidence'
import { nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import DiagnosticArtifactEvidence from './diagnostics/DiagnosticArtifactEvidence.vue'
import DiagnosticSourcesEvidence from './diagnostics/DiagnosticSourcesEvidence.vue'

const props = defineProps<{
  action: AnalyzeActionCenterItem
  evidence: DiagnosticEvidence
  comparisonLabel: string
}>()

const emit = defineEmits<{
  openFile: [file: LargestFileEntry]
  openSource: [meta: TreemapModuleNodeMeta]
  inspect: [item: AnalyzeActionCenterItem]
}>()

const tabs = [
  { id: 'compare', label: '产物对照' },
  { id: 'sources', label: '模块与来源' },
  { id: 'verification', label: '复验条件' },
] as const

type EvidenceTab = typeof tabs[number]['id']

const panelId = useId()
const activeTab = shallowRef<EvidenceTab>('compare')
const panel = useTemplateRef<HTMLElement>('panel')
const tabButtons = useTemplateRef<HTMLButtonElement[]>('tabButtons')

async function selectTab(tab: EvidenceTab, focus = false) {
  activeTab.value = tab
  if (focus) {
    await nextTick()
    tabButtons.value?.find(button => button.dataset.evidenceTab === tab)?.focus()
  }
}

function handleTabKeydown(event: KeyboardEvent, index: number) {
  let targetIndex: number
  if (event.key === 'ArrowRight') {
    targetIndex = (index + 1) % tabs.length
  }
  else if (event.key === 'ArrowLeft') {
    targetIndex = (index + tabs.length - 1) % tabs.length
  }
  else if (event.key === 'Home') {
    targetIndex = 0
  }
  else if (event.key === 'End') {
    targetIndex = tabs.length - 1
  }
  else {
    return
  }
  event.preventDefault()
  const tab = tabs[targetIndex]
  if (tab) {
    void selectTab(tab.id, true)
  }
}

watch(() => props.action.key, () => {
  const focusInside = panel.value?.contains(document.activeElement) ?? false
  void selectTab('compare', focusInside)
})
</script>

<template>
  <section ref="panel" data-diagnostic-evidence aria-label="所选条目的证据工作区" class="grid min-w-0 gap-5">
    <div role="tablist" aria-label="证据视图" class="grid min-w-0 grid-cols-3 border-b border-(--dashboard-border)">
      <button
        v-for="(tab, index) in tabs"
        :id="`${panelId}-tab-${tab.id}`"
        :key="tab.id"
        ref="tabButtons"
        type="button"
        role="tab"
        class="min-h-11 min-w-0 border-b-2 px-2 py-3 text-xs font-medium [overflow-wrap:anywhere] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) sm:text-sm"
        :class="activeTab === tab.id
          ? 'border-(--dashboard-accent) text-(--dashboard-accent)'
          : 'border-transparent text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)'"
        :aria-controls="`${panelId}-panel-${tab.id}`"
        :aria-selected="activeTab === tab.id"
        :tabindex="activeTab === tab.id ? 0 : -1"
        :data-evidence-tab="tab.id"
        @click="selectTab(tab.id)"
        @keydown="handleTabKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      v-show="activeTab === 'compare'"
      :id="`${panelId}-panel-compare`"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="`${panelId}-tab-compare`"
      class="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
    >
      <DiagnosticArtifactEvidence :evidence="evidence" :comparison-label="comparisonLabel" @open-file="emit('openFile', $event)" />
    </div>
    <div
      v-show="activeTab === 'sources'"
      :id="`${panelId}-panel-sources`"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="`${panelId}-tab-sources`"
      class="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
    >
      <DiagnosticSourcesEvidence :evidence="evidence" @open-source="emit('openSource', $event)" />
    </div>
    <div
      v-show="activeTab === 'verification'"
      :id="`${panelId}-panel-verification`"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="`${panelId}-tab-verification`"
      class="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
    >
      <p class="mb-4 text-xs font-medium text-(--dashboard-text-soft)">
        拟议检查 · 尚未运行
      </p>
      <div class="grid gap-5 xl:grid-cols-2">
        <section aria-label="调查步骤">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">
            先补齐证据
          </h3>
          <ol v-if="evidence.steps.length" class="mt-3 grid list-decimal gap-3 pl-5 text-sm leading-6 text-(--dashboard-text-muted)">
            <li v-for="step in evidence.steps" :key="step">{{ step }}</li>
          </ol>
          <p v-else class="mt-3 text-sm text-(--dashboard-text-soft)">当前条目尚无可用调查步骤。</p>
        </section>
        <section aria-label="复验要求" class="border-t border-(--dashboard-border) pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">
            判断是否解决
          </h3>
          <ul v-if="evidence.checks.length" class="mt-3 grid list-disc gap-3 pl-4 text-sm leading-6 text-(--dashboard-text-muted)">
            <li v-for="check in evidence.checks" :key="check">{{ check }}</li>
          </ul>
          <p v-else class="mt-3 text-sm text-(--dashboard-text-soft)">当前条目尚无可用复验条件。</p>
        </section>
      </div>
      <p class="mt-5 border-l-2 border-(--dashboard-accent) pl-3 text-xs leading-5 text-(--dashboard-text-muted)">
        只有构建通过或总量下降不足以宣称解决。需要重新读取实际测量，并验证相关页面与分包运行行为；合理增长可以保留。
      </p>
    </div>

    <footer class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-(--dashboard-border) pt-3">
      <p class="text-xs leading-5 text-(--dashboard-text-soft)">
        更多明细可下钻至现有分析页。
      </p>
      <button
        type="button"
        data-diagnostic-inspect
        class="inline-flex min-h-9 items-center gap-2 rounded-sm px-1 text-xs font-medium text-(--dashboard-text-muted) underline decoration-(--dashboard-border-strong) underline-offset-4 hover:text-(--dashboard-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11"
        @click="emit('inspect', action)"
      >
        查看完整分析
        <span class="icon-[mdi--arrow-right] size-4 shrink-0" aria-hidden="true" />
      </button>
    </footer>
  </section>
</template>
