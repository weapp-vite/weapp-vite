<script setup lang="ts">
import type { AnalyzeBudgetConfig, PackageBudgetWarning, PackageInsight } from '../types'
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import {
  budgetSandboxPresets,
  createBudgetConfigSnippet,
  createBudgetSandboxWarnings,
  defaultAnalyzeBudgetConfig,
  findMatchingBudgetPreset,
  normalizeBudgetSandboxConfig,
} from '../utils/budgetSandbox'
import { copyText } from '../utils/clipboard'
import { formatBytes } from '../utils/format'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'

const props = defineProps<{
  activeBudgetWarningId: string | null
  budgetConfig?: AnalyzeBudgetConfig
  currentWarnings: PackageBudgetWarning[]
  packageInsights: PackageInsight[]
  totalBytes: number
}>()

const emit = defineEmits<{
  selectBudgetWarning: [warning: PackageBudgetWarning]
}>()

const draft = reactive({
  totalMiB: 0,
  mainMiB: 0,
  subPackageMiB: 0,
  independentMiB: 0,
  warningPercent: 85,
})
const actionStatus = reactive({ text: '', timer: null as ReturnType<typeof setTimeout> | null })

function bytesToMiB(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2))
}

function mibToBytes(value: number) {
  return Math.max(1, Math.round((Number.isFinite(value) ? value : 0) * 1024 * 1024))
}

function getInitialConfig() {
  return normalizeBudgetSandboxConfig(props.budgetConfig ?? defaultAnalyzeBudgetConfig)
}

function resetDraft() {
  const config = getInitialConfig()
  draft.totalMiB = bytesToMiB(config.totalBytes)
  draft.mainMiB = bytesToMiB(config.mainBytes)
  draft.subPackageMiB = bytesToMiB(config.subPackageBytes)
  draft.independentMiB = bytesToMiB(config.independentBytes)
  draft.warningPercent = Math.round(config.warningRatio * 100)
}

const sandboxConfig = computed(() => normalizeBudgetSandboxConfig({
  totalBytes: mibToBytes(draft.totalMiB),
  mainBytes: mibToBytes(draft.mainMiB),
  subPackageBytes: mibToBytes(draft.subPackageMiB),
  independentBytes: mibToBytes(draft.independentMiB),
  warningRatio: draft.warningPercent / 100,
}))

const projectedWarnings = computed(() => createBudgetSandboxWarnings({
  totalBytes: props.totalBytes,
  packages: props.packageInsights,
  config: sandboxConfig.value,
}))
const activePresetId = computed(() => findMatchingBudgetPreset(sandboxConfig.value)?.id ?? null)
const currentWarningIds = computed(() => new Set(props.currentWarnings.map(item => item.id)))
const projectedWarningIds = computed(() => new Set(projectedWarnings.value.map(item => item.id)))
const newWarningCount = computed(() => projectedWarnings.value.filter(item => !currentWarningIds.value.has(item.id)).length)
const resolvedWarningCount = computed(() => props.currentWarnings.filter(item => !projectedWarningIds.value.has(item.id)).length)
const snippetText = computed(() => createBudgetConfigSnippet(sandboxConfig.value))
const projectedWarningItems = computed(() => projectedWarnings.value.slice(0, 6).map(item => ({
  key: item.id,
  warning: item,
  active: props.activeBudgetWarningId === item.id,
  title: item.label,
  meta: `${item.status === 'critical' ? '超预算' : '接近预算'} · ${(item.ratio * 100).toFixed(1)}%`,
  value: `${formatBytes(item.currentBytes)} / ${formatBytes(item.limitBytes)}`,
})))

function setActionStatus(text: string) {
  actionStatus.text = text
  if (actionStatus.timer) {
    clearTimeout(actionStatus.timer)
  }
  actionStatus.timer = setTimeout(() => {
    actionStatus.text = ''
    actionStatus.timer = null
  }, 1800)
}

function applyPreset(presetId: string) {
  const preset = budgetSandboxPresets.find(item => item.id === presetId)
  if (!preset) {
    return
  }

  const config = normalizeBudgetSandboxConfig(preset.config)
  draft.totalMiB = bytesToMiB(config.totalBytes)
  draft.mainMiB = bytesToMiB(config.mainBytes)
  draft.subPackageMiB = bytesToMiB(config.subPackageBytes)
  draft.independentMiB = bytesToMiB(config.independentBytes)
  draft.warningPercent = Math.round(config.warningRatio * 100)
  setActionStatus(`已应用 ${preset.label}`)
}

async function copyBudgetSnippet() {
  try {
    await copyText(snippetText.value)
    setActionStatus('已复制')
  }
  catch {
    setActionStatus('复制失败')
  }
}

watch(
  () => props.budgetConfig,
  resetDraft,
  { immediate: true },
)

onBeforeUnmount(() => {
  if (actionStatus.timer) {
    clearTimeout(actionStatus.timer)
  }
})
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-3 shadow-(--dashboard-shadow)">
    <div class="mb-2 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-(--dashboard-text)">
          预算沙盘
        </h3>
        <p class="mt-1 text-xs text-(--dashboard-text-soft)">
          预测 {{ projectedWarnings.length }} 个告警 · 新增 {{ newWarningCount }} · 解除 {{ resolvedWarningCount }}
        </p>
      </div>
      <span v-if="actionStatus.text" class="text-xs font-medium text-(--dashboard-accent)">
        {{ actionStatus.text }}
      </span>
    </div>

    <div class="grid min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="preset in budgetSandboxPresets"
          :key="preset.id"
          class="rounded-md border px-2 py-2 text-left transition"
          :class="activePresetId === preset.id ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft) text-(--dashboard-text)' : 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-soft) hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)'"
          type="button"
          @click="applyPreset(preset.id)"
        >
          <span class="block truncate text-xs font-semibold">
            {{ preset.label }}
          </span>
          <span class="mt-1 line-clamp-2 block text-[11px] leading-4 opacity-80">
            {{ preset.detail }}
          </span>
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <label class="grid gap-1 text-[11px] text-(--dashboard-text-soft)">
          总包 MB
          <input v-model.number="draft.totalMiB" class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 text-sm text-(--dashboard-text) outline-none focus:border-(--dashboard-accent)" min="0.01" step="0.01" type="number">
        </label>
        <label class="grid gap-1 text-[11px] text-(--dashboard-text-soft)">
          主包 MB
          <input v-model.number="draft.mainMiB" class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 text-sm text-(--dashboard-text) outline-none focus:border-(--dashboard-accent)" min="0.01" step="0.01" type="number">
        </label>
        <label class="grid gap-1 text-[11px] text-(--dashboard-text-soft)">
          分包 MB
          <input v-model.number="draft.subPackageMiB" class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 text-sm text-(--dashboard-text) outline-none focus:border-(--dashboard-accent)" min="0.01" step="0.01" type="number">
        </label>
        <label class="grid gap-1 text-[11px] text-(--dashboard-text-soft)">
          独立分包 MB
          <input v-model.number="draft.independentMiB" class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 text-sm text-(--dashboard-text) outline-none focus:border-(--dashboard-accent)" min="0.01" step="0.01" type="number">
        </label>
      </div>

      <div class="grid gap-2">
        <label class="grid gap-1 text-[11px] text-(--dashboard-text-soft)">
          预警线 {{ draft.warningPercent }}%
          <input v-model.number="draft.warningPercent" class="accent-(--dashboard-accent)" max="99" min="1" step="1" type="range">
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-xs text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)" type="button" @click="resetDraft">
            重置
          </button>
          <button class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-xs text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent)" type="button" @click="copyBudgetSnippet">
            复制配置
          </button>
        </div>
      </div>

      <div class="min-h-0 overflow-y-auto pr-1">
        <AppEmptyState v-if="projectedWarningItems.length === 0" compact>
          当前沙盘预算下没有预计告警。
        </AppEmptyState>
        <ul v-else class="grid content-start gap-2 text-sm text-(--dashboard-text-muted)">
          <AppCompactListItem
            v-for="item in projectedWarningItems"
            :key="item.key"
            :active="item.active"
            clickable
            :meta="item.meta"
            :title="item.title"
            :value="item.value"
            @select="emit('selectBudgetWarning', item.warning)"
          />
        </ul>
      </div>
    </div>
  </section>
</template>
