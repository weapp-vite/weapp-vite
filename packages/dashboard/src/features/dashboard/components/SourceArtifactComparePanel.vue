<script setup lang="ts">
import type { LargestFileEntry } from '../types'
import { toRefs } from 'vue'
import { useSourceArtifactCompare } from '../composables/useSourceArtifactCompare'
import AppEmptyState from './AppEmptyState.vue'

const props = defineProps<{
  activeFileKey: string | null
  files: LargestFileEntry[]
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  selectFile: [file: LargestFileEntry]
}>()

const { activeFileKey, files, theme } = toRefs(props)
const {
  artifactContent,
  artifactOptions,
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
        <button
          type="button"
          class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
          :disabled="loading || !selectedArtifactKey || !selectedSourcePath"
          @click="loadComparison"
        >
          刷新
        </button>
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
    </div>

    <div class="min-h-0 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted)">
      <div v-show="sourceContent && artifactContent" ref="editorElement" class="h-full min-h-96" />
      <AppEmptyState v-if="!sourceContent || !artifactContent" class="m-3 h-[calc(100%-1.5rem)]">
        {{ loadError || '暂无可对比文件。' }}
      </AppEmptyState>
    </div>
  </section>
</template>
