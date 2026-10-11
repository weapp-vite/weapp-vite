<script setup lang="ts">
import type { DashboardInvestigationTarget } from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult, ResolvedTheme } from '../../types'
import type { InspectionNode } from '../../utils/objectInspection'
import { computed, nextTick, shallowRef, toRefs, watch } from 'vue'
import { useObjectInspection } from '../../composables/useObjectInspection'
import { dashboardAnalyzeRevision, dashboardConnectionStatus } from '../../utils/dashboardDevframe'
import AppSelect from '../AppSelect.vue'
import SourceArtifactComparePanel from '../SourceArtifactComparePanel.vue'
import ObjectBuildChanges from './ObjectBuildChanges.vue'
import ObjectEvidence from './ObjectEvidence.vue'
import ObjectRelationLanes from './ObjectRelationLanes.vue'

const props = defineProps<{
  result: AnalyzeSubpackagesResult
  comparisonResult: AnalyzeSubpackagesResult | null
  target: DashboardInvestigationTarget | null
  theme: ResolvedTheme
  sourcePath: string | null
  baselineLabel: string
  investigationRequestId: number
}>()
const emit = defineEmits<{
  selectTarget: [target: DashboardInvestigationTarget]
  investigate: [target: DashboardInvestigationTarget]
}>()
const { result, target } = toRefs(props)
const { index, selected, selectedArtifact, targetMissing, packageFilter, packageQuery, artifactQuery, moduleQuery, packages, artifacts, modules } = useObjectInspection({ result, target })
const dock = shallowRef<'evidence' | 'content' | 'changes' | 'investigation'>('evidence')
const dockElement = shallowRef<HTMLElement | null>(null)
const dockTabs = [
  { key: 'evidence' as const, label: '当前对象' },
  { key: 'content' as const, label: '内容' },
  { key: 'changes' as const, label: '构建变化' },
  { key: 'investigation' as const, label: '调查' },
]
const packageOptions = computed(() => [
  { value: '', label: '全部包（显式范围）' },
  ...index.value.packages.map(node => ({ value: node.target.packageId, label: `${node.label} · ${node.target.packageId}` })),
])
const readerArtifact = computed(() => selectedArtifact.value?.target.kind === 'artifact'
  ? { key: selectedArtifact.value.key, file: selectedArtifact.value.target.file }
  : null)
const canInvestigate = computed(() => Boolean(selected.value
  && (selected.value.target.kind === 'package' || selectedArtifact.value)))
const readerSource = computed(() => {
  if (!selected.value || selected.value.target.kind === 'package') {
    return null
  }
  if (selected.value.target.kind === 'module') {
    return selected.value.sourcePath
  }
  const requested = props.sourcePath?.split('?')[0]
  if (requested && (selected.value.sourcePath === requested || index.value.modules.some(node => node.artifactKey === selected.value?.key && node.sourcePath === requested))) {
    return requested
  }
  return selected.value.sourcePath
})
const connectionText = computed(() => dashboardConnectionStatus.value !== 'connected'
  ? '后端未连接'
  : dashboardAnalyzeRevision.value === null ? '报告同步中' : `报告修订 ${dashboardAnalyzeRevision.value}`)

function revealDock() {
  void nextTick(() => {
    dockElement.value?.scrollIntoView({ block: 'start' })
    dockElement.value?.focus({ preventScroll: true })
  })
}

watch(() => props.sourcePath, (value) => {
  if (value) {
    dock.value = 'content'
    revealDock()
  }
}, { immediate: true })
watch(() => props.investigationRequestId, (value) => {
  if (value > 0) {
    dock.value = 'investigation'
    revealDock()
  }
}, { immediate: true })

function selectNode(node: InspectionNode) {
  emit('selectTarget', node.target)
  if (node.target.kind === 'module') {
    dock.value = 'content'
    revealDock()
  }
}

function investigate() {
  if (!selected.value || !canInvestigate.value) {
    return
  }
  dock.value = 'investigation'
  emit('investigate', selected.value.target)
}
</script>

<template>
  <section class="object-workbench" aria-label="关联工作台">
    <header class="workbench-heading">
      <div>
        <h2>关联工作台</h2>
        <p v-if="selected" class="current-object">
          <span>{{ selected.target.kind === 'package' ? '包' : selected.target.kind === 'artifact' ? '产物' : '模块' }}</span>
          <code>{{ selected.label }}</code>
        </p>
        <p class="context-line">{{ result.packages.length }} 个包 / {{ index.artifacts.length }} 个产物 / {{ index.modules.length }} 个模块落点 · 基线：{{ comparisonResult ? baselineLabel || '已选择历史报告' : '未选择' }}</p>
      </div>
      <button type="button" class="inspect-button" :disabled="!selected" @click="dock = 'evidence'; revealDock()">查看证据</button>
      <button type="button" class="investigate-button" :disabled="!canInvestigate" @click="investigate">创建调查</button>
    </header>
    <p v-if="targetMissing" class="workbench-notice" role="status">原对象已不在当前报告中{{ selected ? '，暂展示当前报告中的真实对象' : '，当前报告暂无可展示对象' }}；浏览筛选与调查草稿未改变。</p>
    <p v-if="dashboardConnectionStatus !== 'connected' || dashboardAnalyzeRevision === null" class="workbench-notice" role="status">{{ connectionText }}。保留报告浏览上下文；内容读取等待当前报告同步，不显示旧修订内容。</p>
    <p v-if="selected?.placementOnly && !selectedArtifact" class="workbench-notice" role="status">报告记录了模块落点，但未收录对应产物。保留归属证据，不提供内容读取或调查提交。</p>
    <div class="stage-heading">
      <div><h3>报告收录关系</h3><p>选择只改变检查对象，不缩小列表或修改搜索。</p></div>
      <div class="package-filter"><AppSelect v-model="packageFilter" label="筛选包范围（与对象选择独立）" :options="packageOptions" /></div>
    </div>
    <p v-if="!index.packages.length && !index.artifacts.length && !index.modules.length" class="workbench-notice" role="status">当前报告没有收录对象。构建完成后，真实的包、产物与模块关系会出现在这里。</p>
    <ObjectRelationLanes
      v-else v-model:package-query="packageQuery" v-model:artifact-query="artifactQuery" v-model:module-query="moduleQuery"
      :packages="packages" :artifacts="artifacts" :modules="modules" :selected="selected" @select="selectNode"
    />
    <section ref="dockElement" class="context-dock" tabindex="-1" aria-label="当前对象检查区">
      <header class="dock-toolbar">
        <div class="dock-tabs" role="group" aria-label="检查内容">
          <button v-for="tab in dockTabs" :key="tab.key" type="button" :aria-pressed="dock === tab.key" @click="dock = tab.key">{{ tab.label }}</button>
        </div>
        <span class="dock-status">{{ connectionText }}</span>
      </header>
      <div v-show="dock === 'evidence'" class="dock-body">
        <ObjectEvidence v-if="selected" :node="selected" :artifact="selectedArtifact" @select="selectNode" @content="dock = 'content'" />
        <p v-else>选择报告中的对象后，在此检查证据。</p>
      </div>
      <div v-if="dock === 'content'" class="dock-body">
        <p v-if="selected?.target.kind === 'package'">包没有单独的文本内容。请选择产物或模块，包范围不会因选择自动改变。</p>
        <template v-else>
          <p v-if="selected?.placementOnly" class="content-note">此模块只有报告落点，没有源码读取授权或测量归因；仅尝试读取真实存在的所属产物。</p>
          <p v-else-if="selected?.target.kind === 'module' && !readerSource" class="content-note">此模块源码不可读取，下面展示所属产物（如果可读）。</p>
          <SourceArtifactComparePanel :artifact="readerArtifact" :source-path="readerSource" :theme="theme" />
        </template>
      </div>
      <div v-if="dock === 'changes'" class="dock-body">
        <ObjectBuildChanges v-if="selected" :node="selected" :comparison-result="comparisonResult" :baseline-label="baselineLabel" />
        <p v-else>当前没有可比较对象。</p>
      </div>
      <div v-show="dock === 'investigation'" class="dock-body">
        <slot name="investigation" />
      </div>
    </section>
  </section>
</template>

<style scoped>
.object-workbench {
  min-width: 0;
  padding: 4px 0 20px;
  color: var(--dashboard-text);
}

.workbench-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 12px;
}

.workbench-heading > div {
  flex: 1;
  min-width: 0;
}

.workbench-heading h2 {
  margin: 0 0 6px;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.4px;
}

.current-object {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin: 0;
  font-size: 13px;
}

.current-object span {
  flex-shrink: 0;
  color: var(--dashboard-accent);
}

.current-object code {
  font-family: var(--dashboard-code);
  overflow-wrap: anywhere;
}

.context-line {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--dashboard-text-muted);
}

.inspect-button {
  min-height: 40px;
  padding: 8px;
  font-size: 13px;
  color: var(--dashboard-accent);
  background: transparent;
  border: 0;
}

.investigate-button {
  min-height: 40px;
  padding: 9px 15px;
  font-size: 13px;
  font-weight: 600;
  color: var(--dashboard-text);
  background: var(--dashboard-accent-soft);
  border: 1px solid var(--dashboard-accent);
  border-radius: 6px;
}

.investigate-button:disabled {
  opacity: 0.5;
}

.workbench-notice {
  padding: 12px 15px;
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.7;
  background: var(--dashboard-panel);
  border-left: 2px solid var(--dashboard-accent);
}

.stage-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-top: 1px solid var(--dashboard-border);
}

.stage-heading h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 550;
}

.stage-heading p {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--dashboard-text-soft);
}

.package-filter {
  width: 260px;
  max-width: 100%;
}

.context-dock {
  scroll-margin-top: 12px;
  background: var(--dashboard-shell);
  border-top: 2px solid var(--dashboard-border-strong);
}

.dock-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--dashboard-border);
}

.dock-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.dock-tabs button {
  min-height: 46px;
  padding: 12px 0 10px;
  font-size: 13px;
  color: var(--dashboard-text-muted);
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
}

.dock-tabs button[aria-pressed='true'] {
  color: var(--dashboard-text);
  border-bottom-color: var(--dashboard-accent);
}

.dock-status {
  padding: 8px 0;
  font-size: 12px;
  color: var(--dashboard-text-soft);
}

.dock-body {
  padding: 20px;
  font-size: 13px;
}

.content-note {
  margin: 0 0 14px;
  line-height: 1.7;
  color: var(--dashboard-text-muted);
}

@media (max-width: 760px) {
  .workbench-heading > div {
    flex-basis: 100%;
  }

  .dock-body {
    padding: 16px 12px;
  }

  .dock-toolbar {
    padding: 0 12px;
  }

  .dock-tabs {
    gap: 16px;
  }
}
</style>
