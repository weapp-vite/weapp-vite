<script setup lang="ts">
import type { AnalyzeActionCenterItem, LargestFileEntry, TreemapModuleNodeMeta } from '../types'
import type { DiagnosticEvidence } from '../utils/diagnosticEvidence'
import { nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import DiagnosticArtifactEvidence from './diagnostics/DiagnosticArtifactEvidence.vue'
import DiagnosticSourcesEvidence from './diagnostics/DiagnosticSourcesEvidence.vue'

const props = defineProps<{
  action: AnalyzeActionCenterItem | undefined
  evidence: DiagnosticEvidence | null
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

watch(() => props.action?.key, () => {
  const focusInside = Boolean(panel.value?.contains(document.activeElement) || tabButtons.value?.includes(document.activeElement as HTMLButtonElement))
  void selectTab('compare', focusInside)
})
</script>

<template>
  <section data-diagnostic-evidence aria-label="所选条目的证据工作区" class="diagnostic-workspace min-w-0">
    <div class="diagnostic-columns grid min-w-0 items-start overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel)">
      <aside class="diagnostic-index min-w-0 border-b border-(--dashboard-border) bg-(--dashboard-bg) p-3" aria-label="问题与线索索引">
        <slot name="index" />
      </aside>
      <div ref="panel" class="grid min-w-0 content-start gap-3 p-3 sm:p-4">
        <slot v-if="action && evidence" name="heading" />
        <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-(--dashboard-border)">
          <div v-if="action && evidence" role="tablist" aria-label="证据视图" class="flex min-w-0 gap-5">
            <button
              v-for="(tab, index) in tabs"
              :id="`${panelId}-tab-${tab.id}`"
              :key="tab.id"
              ref="tabButtons"
              type="button"
              role="tab"
              class="min-h-11 min-w-0 border-b-2 py-2 text-sm font-medium [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
              :class="activeTab === tab.id
                ? 'border-(--dashboard-accent) text-(--dashboard-accent)'
                : 'border-transparent text-(--dashboard-text-muted) hover:text-(--dashboard-text)'"
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
          <slot name="controls" />
        </div>
        <template v-if="action && evidence">
          <div
            v-show="activeTab === 'compare'"
            :id="`${panelId}-panel-compare`"
            role="tabpanel"
            tabindex="0"
            :aria-labelledby="`${panelId}-tab-compare`"
            class="min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
          >
            <DiagnosticArtifactEvidence :evidence="evidence" :comparison-label="comparisonLabel" @open-file="emit('openFile', $event)" @show-sources="selectTab('sources', true)" />
          </div>
          <div
            v-show="activeTab === 'sources'"
            :id="`${panelId}-panel-sources`"
            role="tabpanel"
            tabindex="0"
            :aria-labelledby="`${panelId}-tab-sources`"
            class="min-w-0 border-t border-(--dashboard-border) pt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
          >
            <DiagnosticSourcesEvidence :evidence="evidence" @open-source="emit('openSource', $event)" />
          </div>
          <div
            v-show="activeTab === 'verification'"
            :id="`${panelId}-panel-verification`"
            role="tabpanel"
            tabindex="0"
            :aria-labelledby="`${panelId}-tab-verification`"
            class="min-w-0 border-t border-(--dashboard-border) pt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
          >
            <p class="mb-5 font-mono text-xs text-(--dashboard-text-soft)">拟议检查 · 尚未运行</p>
            <div class="diagnostic-verification grid gap-6">
              <section aria-label="调查步骤">
                <h3 class="text-base font-semibold text-(--dashboard-text)">先补齐证据</h3>
                <ol v-if="evidence.steps.length" class="mt-3 grid list-decimal gap-3 pl-5 text-sm leading-6 text-(--dashboard-text-muted)">
                  <li v-for="step in evidence.steps" :key="step">{{ step }}</li>
                </ol>
                <p v-else class="mt-3 text-sm text-(--dashboard-text-soft)">当前条目尚无可用调查步骤。</p>
              </section>
              <section aria-label="复验要求">
                <h3 class="text-base font-semibold text-(--dashboard-text)">判断是否解决</h3>
                <ul v-if="evidence.checks.length" class="mt-3 grid gap-3 text-sm leading-6 text-(--dashboard-text-muted)">
                  <li v-for="check in evidence.checks" :key="check" class="border-b border-(--dashboard-border) pb-3">{{ check }}</li>
                </ul>
                <p v-else class="mt-3 text-sm text-(--dashboard-text-soft)">当前条目尚无可用复验条件。</p>
              </section>
            </div>
            <p class="mt-5 border-l-2 border-(--dashboard-accent) pl-3 text-xs leading-5 text-(--dashboard-text-muted)">
              只有构建通过或总量下降不足以宣称解决。需要重新读取实际测量，并验证相关页面与分包运行行为；合理增长可以保留。
            </p>
          </div>
          <footer class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-(--dashboard-text-soft)">
            <p>产物数据不等于源码因果。</p>
            <button type="button" data-diagnostic-inspect class="inline-flex min-h-11 items-center gap-2 text-(--dashboard-accent) hover:underline" @click="emit('inspect', action)">
              查看完整分析
              <span class="icon-[mdi--arrow-right] size-4 shrink-0" aria-hidden="true" />
            </button>
          </footer>
        </template>
        <div v-else class="min-w-0 border-l-2 border-(--dashboard-accent) py-2 pl-4">
          <h2 class="font-semibold text-(--dashboard-text)">当前没有预算风险或待查线索</h2>
          <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">可从包体图继续查看产物；构建数据不代表运行时已经验收。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diagnostic-workspace {
  container: diagnostics / inline-size;
}

@container diagnostics (min-width: 52rem) {
  .diagnostic-columns {
    grid-template-columns: 17rem minmax(0, 1fr);
  }

  .diagnostic-index {
    align-self: stretch;
    border-right: 1px solid var(--dashboard-border);
    border-bottom: 0;
  }
}

@container diagnostics (min-width: 76rem) {
  .diagnostic-columns {
    grid-template-columns: 20rem minmax(0, 1fr);
    gap: 0;
  }

  .diagnostic-verification {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
