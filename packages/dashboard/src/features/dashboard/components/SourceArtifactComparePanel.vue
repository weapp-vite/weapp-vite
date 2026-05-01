<script setup lang="ts">
import type { LargestFileEntry } from '../types'
import type { SourceCompareInsightTone } from '../utils/sourceCompareSummary'
import { computed, onBeforeUnmount, ref, toRefs } from 'vue'
import { useSourceArtifactCompare } from '../composables/useSourceArtifactCompare'
import { copyText } from '../utils/clipboard'
import { formatBytes } from '../utils/format'
import { createSourceCompareInsights, createSourceCompareReport, formatSignedBytes } from '../utils/sourceCompareSummary'
import AppEmptyState from './AppEmptyState.vue'
import AppMetricTile from './AppMetricTile.vue'

const props = defineProps<{
  activeFileKey: string | null
  files: LargestFileEntry[]
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  selectFile: [file: LargestFileEntry]
}>()

const { activeFileKey, files, theme } = toRefs(props)
const copyStatus = ref('')
let copyStatusTimer: ReturnType<typeof setTimeout> | null = null
const {
  artifactContent,
  artifactOptions,
  compareStats,
  editorElement,
  loadComparison,
  loadError,
  loading,
  selectedArtifactKey,
  selectedSourcePath,
  sourceContent,
  sourceOptions,
  statusText,
} = useSourceArtifactCompare({
  activeFileKey,
  files,
  theme,
  onSelectFile(file) {
    emit('selectFile', file)
  },
})

const compareMetricItems = computed(() => compareStats.value
  ? [
      { label: '源码行数', value: String(compareStats.value.sourceLines) },
      { label: '产物行数', value: String(compareStats.value.artifactLines) },
      { label: '新增 / 删除', value: `${compareStats.value.addedLines} / ${compareStats.value.removedLines}` },
      { label: '字节变化', value: formatSignedBytes(compareStats.value.byteDelta) },
    ]
  : [])

const compareSizeText = computed(() => compareStats.value
  ? `${formatBytes(compareStats.value.sourceBytes)} → ${formatBytes(compareStats.value.artifactBytes)}`
  : '')
const compareInsights = computed(() => compareStats.value ? createSourceCompareInsights(compareStats.value) : [])

function getInsightClassName(tone: SourceCompareInsightTone) {
  if (tone === 'warning') {
    return 'border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200'
  }
  if (tone === 'success') {
    return 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
  }
  return 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text)'
}

function setCopyStatus(status: string) {
  copyStatus.value = status
  if (copyStatusTimer) {
    clearTimeout(copyStatusTimer)
  }
  copyStatusTimer = setTimeout(() => {
    copyStatus.value = ''
    copyStatusTimer = null
  }, 1800)
}

async function copyCompareReport() {
  if (!compareStats.value || !sourceContent.value || !artifactContent.value) {
    return
  }
  try {
    await copyText(createSourceCompareReport({
      sourcePath: sourceContent.value.path,
      artifactPath: artifactContent.value.path,
      stats: compareStats.value,
      insights: compareInsights.value,
    }))
    setCopyStatus('已复制')
  }
  catch {
    setCopyStatus('复制失败')
  }
}

onBeforeUnmount(() => {
  if (copyStatusTimer) {
    clearTimeout(copyStatusTimer)
  }
})
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-3 shadow-(--dashboard-shadow)">
    <div class="grid gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-(--dashboard-text)">
            源码对比
          </h2>
          <p class="mt-1 text-xs text-(--dashboard-text-soft)">
            {{ statusText }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="copyStatus" class="text-xs font-medium text-(--dashboard-accent)">
            {{ copyStatus }}
          </span>
          <button
            type="button"
            class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
            :disabled="!compareStats"
            @click="copyCompareReport"
          >
            复制摘要
          </button>
          <button
            type="button"
            class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
            :disabled="loading || !selectedArtifactKey || !selectedSourcePath"
            @click="loadComparison"
          >
            刷新
          </button>
        </div>
      </div>
      <div class="grid gap-2 lg:grid-cols-2">
        <select
          v-model="selectedSourcePath"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="">
            源码文件
          </option>
          <option v-for="source in sourceOptions" :key="source" :value="source">
            {{ source }}
          </option>
        </select>
        <select
          v-model="selectedArtifactKey"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option v-for="item in artifactOptions" :key="item.key" :value="item.key">
            {{ item.label }}
          </option>
        </select>
      </div>
      <div v-if="compareStats" class="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div class="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <AppMetricTile
            v-for="item in compareMetricItems"
            :key="item.label"
            v-bind="item"
          />
        </div>
        <p class="text-xs text-(--dashboard-text-soft)">
          {{ compareSizeText }}
        </p>
      </div>
      <div v-if="compareInsights.length" class="grid gap-2 lg:grid-cols-3">
        <article
          v-for="item in compareInsights"
          :key="item.id"
          class="rounded-md border px-3 py-2.5"
          :class="getInsightClassName(item.tone)"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
              {{ item.label }}
            </p>
            <p class="shrink-0 text-sm font-semibold">
              {{ item.value }}
            </p>
          </div>
          <p class="mt-2 line-clamp-2 text-xs leading-5 opacity-80">
            {{ item.detail }}
          </p>
        </article>
      </div>
    </div>

    <div class="min-h-0 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted)">
      <div v-show="sourceContent && artifactContent" ref="editorElement" class="h-full min-h-96" />
      <AppEmptyState v-if="!sourceContent || !artifactContent" class="m-3 h-[calc(100%-1.5rem)]">
        {{ loadError || '暂无可对比文件。' }}
      </AppEmptyState>
    </div>
  </section>
</template>
