<script setup lang="ts">
import type { DashboardDetailItem, LargestFileEntry, TreemapNodeMeta } from '../types'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes, formatPackageType } from '../utils/format'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'

type FileTypeFilter = 'all' | LargestFileEntry['type']
type FileSortMode = 'size' | 'compressed' | 'delta' | 'modules' | 'name'

const props = defineProps<{
  largestFiles: LargestFileEntry[]
  activeLargestFileKey: string | null
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const emit = defineEmits<{
  selectFile: [file: LargestFileEntry]
}>()

const fileQuery = ref('')
const fileTypeFilter = ref<FileTypeFilter>('all')
const fileSortMode = ref<FileSortMode>('size')
const actionStatus = ref('')
let actionStatusTimer: ReturnType<typeof setTimeout> | null = null

function formatDelta(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes === 0) {
    return ''
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function createLargestFileItem(file: LargestFileEntry): DashboardDetailItem {
  const delta = formatDelta(file.sizeDeltaBytes)
  return {
    title: file.file,
    meta: `${file.packageLabel} · ${formatPackageType(file.packageType)} · ${file.type}${delta ? ` · ${delta}` : ''}`,
    value: `${formatBytes(file.size)} / ${formatBytes(file.compressedSize)}`,
  }
}

function formatSelectedMeta(meta: TreemapNodeMeta): DashboardDetailItem {
  if (meta.kind === 'package') {
    return {
      title: meta.packageLabel,
      meta: `${formatPackageType(meta.packageType)} · ${meta.fileCount} 个产物`,
      value: formatBytes(meta.totalBytes),
    }
  }
  if (meta.kind === 'file') {
    return {
      title: meta.fileName,
      meta: `${meta.packageLabel} · ${meta.type} · ${meta.childCount} 项`,
      value: formatBytes(meta.bytes),
    }
  }
  if (meta.kind === 'module') {
    return {
      title: meta.source,
      meta: `${meta.packageLabel} · ${meta.packageCount} 个包复用`,
      value: formatBytes(meta.bytes ?? meta.originalBytes),
    }
  }
  return {
    title: meta.source,
    meta: `${meta.packageLabel} · ${meta.fileName}`,
    value: formatBytes(meta.bytes),
  }
}

function escapeMarkdownCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

const fileTypeOptions = computed(() => {
  const typeSet = new Set<LargestFileEntry['type']>()
  for (const file of props.largestFiles) {
    typeSet.add(file.type)
  }
  return [...typeSet].sort((a, b) => a.localeCompare(b))
})

const largestFileItems = computed(() => {
  const keyword = fileQuery.value.trim().toLowerCase()
  return props.largestFiles
    .filter((file) => {
      if (fileTypeFilter.value !== 'all' && file.type !== fileTypeFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        file.file,
        file.packageId,
        file.packageLabel,
        file.packageType,
        file.type,
        file.source,
      ].some(value => value?.toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (fileSortMode.value === 'compressed') {
        return b.compressedSize - a.compressedSize || a.file.localeCompare(b.file)
      }
      if (fileSortMode.value === 'delta') {
        return (b.sizeDeltaBytes ?? Number.NEGATIVE_INFINITY) - (a.sizeDeltaBytes ?? Number.NEGATIVE_INFINITY) || a.file.localeCompare(b.file)
      }
      if (fileSortMode.value === 'modules') {
        return b.moduleCount - a.moduleCount || b.size - a.size || a.file.localeCompare(b.file)
      }
      if (fileSortMode.value === 'name') {
        return a.file.localeCompare(b.file)
      }
      return b.size - a.size || a.file.localeCompare(b.file)
    })
    .map(file => ({
      key: `${file.packageId}:${file.file}`,
      file,
      active: props.activeLargestFileKey === `${file.packageId}:${file.file}`
        || (
          props.selectedTreemapMeta?.kind !== 'package'
          && props.selectedTreemapMeta?.packageLabel === file.packageLabel
          && props.selectedTreemapMeta?.fileName === file.file
        ),
      ...createLargestFileItem(file),
    }))
})

const selectedItem = computed(() => props.selectedTreemapMeta ? formatSelectedMeta(props.selectedTreemapMeta) : null)

const fileReportText = computed(() => [
  '# dashboard 文件详情',
  '',
  `文件数量：${largestFileItems.value.length} / ${props.largestFiles.length}`,
  '',
  '| 文件 | 包 | 类型 | 总体积 | 压缩后 | 较上次 | 模块 | 来源 |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
  ...largestFileItems.value.map(({ file }) => [
    file.file,
    file.packageLabel,
    file.type,
    formatBytes(file.size),
    formatBytes(file.compressedSize),
    formatDelta(file.sizeDeltaBytes) || '-',
    String(file.moduleCount),
    file.source ?? '-',
  ].map(escapeMarkdownCell).join(' | ')).map(row => `| ${row} |`),
  '',
].join('\n'))

function setActionStatus(status: string) {
  actionStatus.value = status
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer)
  }
  actionStatusTimer = setTimeout(() => {
    actionStatus.value = ''
    actionStatusTimer = null
  }, 1800)
}

async function copyFileReport() {
  try {
    await copyText(fileReportText.value)
    setActionStatus('已复制')
  }
  catch {
    setActionStatus('复制失败')
  }
}

function exportFileJson() {
  const blob = new Blob([`${JSON.stringify(largestFileItems.value.map(item => item.file), null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-dashboard-files.json'
  anchor.click()
  URL.revokeObjectURL(url)
  setActionStatus('已导出')
}

onBeforeUnmount(() => {
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer)
  }
})
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-3 shadow-(--dashboard-shadow)">
    <div class="mb-2 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-(--dashboard-text)">
          Top Files
        </h3>
        <p class="mt-1 text-xs text-(--dashboard-text-soft)">
          匹配 {{ largestFileItems.length }} / {{ largestFiles.length }} 个文件
        </p>
      </div>
      <span class="text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft)">size</span>
    </div>
    <div class="mb-3 grid gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="actionStatus" class="text-xs font-medium text-(--dashboard-accent)">
          {{ actionStatus }}
        </span>
        <button
          type="button"
          class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
          :disabled="largestFileItems.length === 0"
          @click="copyFileReport"
        >
          复制文件
        </button>
        <button
          type="button"
          class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
          :disabled="largestFileItems.length === 0"
          @click="exportFileJson"
        >
          导出 JSON
        </button>
      </div>
      <input
        v-model="fileQuery"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text) outline-none transition placeholder:text-(--dashboard-text-soft) focus:border-(--dashboard-accent)"
        placeholder="搜索文件、包或来源"
        type="search"
      >
      <div class="grid grid-cols-2 gap-2">
        <select
          v-model="fileTypeFilter"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="all">
            全部类型
          </option>
          <option
            v-for="type in fileTypeOptions"
            :key="type"
            :value="type"
          >
            {{ type }}
          </option>
        </select>
        <select
          v-model="fileSortMode"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="size">
            按体积
          </option>
          <option value="compressed">
            按压缩后
          </option>
          <option value="delta">
            按增量
          </option>
          <option value="modules">
            按模块数
          </option>
          <option value="name">
            按名称
          </option>
        </select>
      </div>
    </div>
    <div class="min-h-0 overflow-y-auto pr-1">
      <AppCompactListItem
        v-if="selectedItem"
        class="mb-2"
        v-bind="selectedItem"
      />
      <ol class="grid gap-2 text-sm">
        <AppEmptyState v-if="largestFileItems.length === 0" as="li" compact>
          没有匹配当前筛选条件的文件。
        </AppEmptyState>
        <AppCompactListItem
          v-for="item in largestFileItems"
          :key="item.key"
          :active="item.active"
          clickable
          :meta="item.meta"
          :title="item.title"
          :value="item.value"
          @select="emit('selectFile', item.file)"
        />
      </ol>
    </div>
  </section>
</template>
