<script setup lang="ts">
import type { ModuleSourceType, SelectedFileModuleDetail } from '../types'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes } from '../utils/format'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'

type ModuleSourceFilter = 'all' | ModuleSourceType
type ModuleSortMode = 'saving' | 'size' | 'duplicates' | 'source'

const props = defineProps<{
  selectedFileModules: SelectedFileModuleDetail[]
}>()

const moduleQuery = ref('')
const moduleSourceFilter = ref<ModuleSourceFilter>('all')
const moduleSortMode = ref<ModuleSortMode>('saving')
const actionStatus = ref('')
let actionStatusTimer: ReturnType<typeof setTimeout> | null = null

function escapeMarkdownCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

const moduleSourceOptions = computed(() => {
  const sourceSet = new Set<ModuleSourceType>()
  for (const item of props.selectedFileModules) {
    sourceSet.add(item.sourceType)
  }
  return [...sourceSet].sort((a, b) => a.localeCompare(b))
})

const filteredSelectedFileModules = computed(() => {
  const keyword = moduleQuery.value.trim().toLowerCase()
  return props.selectedFileModules
    .filter((item) => {
      if (moduleSourceFilter.value !== 'all' && item.sourceType !== moduleSourceFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        item.key,
        item.source,
        item.sourceType,
        item.duplicatePackageCount,
        item.bytes,
      ].some(value => String(value).toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (moduleSortMode.value === 'size') {
        return b.bytes - a.bytes || b.estimatedSavingBytes - a.estimatedSavingBytes || a.source.localeCompare(b.source)
      }
      if (moduleSortMode.value === 'duplicates') {
        return b.duplicatePackageCount - a.duplicatePackageCount || b.estimatedSavingBytes - a.estimatedSavingBytes || a.source.localeCompare(b.source)
      }
      if (moduleSortMode.value === 'source') {
        return a.source.localeCompare(b.source)
      }
      return b.estimatedSavingBytes - a.estimatedSavingBytes || b.bytes - a.bytes || a.source.localeCompare(b.source)
    })
})

const selectedFileModuleItems = computed(() => filteredSelectedFileModules.value.map(item => ({
  key: item.key,
  title: item.source,
  meta: `${item.sourceType} · ${item.duplicatePackageCount > 1 ? `${item.duplicatePackageCount} 个包复用` : '单包模块'} · 可节省 ${formatBytes(item.estimatedSavingBytes)}`,
  value: item.originalBytes && item.originalBytes !== item.bytes
    ? `${formatBytes(item.bytes)} / ${formatBytes(item.originalBytes)}`
    : formatBytes(item.bytes),
})))

const moduleReportText = computed(() => [
  '# dashboard 文件模块明细',
  '',
  `模块数量：${filteredSelectedFileModules.value.length} / ${props.selectedFileModules.length}`,
  '',
  '| 模块 | 来源 | 体积 | 原始体积 | 复用包 | 可节省 |',
  '| --- | --- | ---: | ---: | ---: | ---: |',
  ...filteredSelectedFileModules.value.map(item => [
    item.source,
    item.sourceType,
    formatBytes(item.bytes),
    item.originalBytes ? formatBytes(item.originalBytes) : '-',
    String(item.duplicatePackageCount),
    formatBytes(item.estimatedSavingBytes),
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

async function copyModuleReport() {
  try {
    await copyText(moduleReportText.value)
    setActionStatus('已复制')
  }
  catch {
    setActionStatus('复制失败')
  }
}

function exportModuleJson() {
  const blob = new Blob([`${JSON.stringify(filteredSelectedFileModules.value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-dashboard-file-modules.json'
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
          文件详情
        </h3>
        <p class="mt-1 text-xs text-(--dashboard-text-soft)">
          匹配 {{ selectedFileModuleItems.length }} / {{ selectedFileModules.length }} 个模块
        </p>
      </div>
      <span class="text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft)">modules</span>
    </div>
    <div class="mb-3 grid gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="actionStatus" class="text-xs font-medium text-(--dashboard-accent)">
          {{ actionStatus }}
        </span>
        <button
          type="button"
          class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
          :disabled="selectedFileModuleItems.length === 0"
          @click="copyModuleReport"
        >
          复制模块
        </button>
        <button
          type="button"
          class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none disabled:opacity-50"
          :disabled="selectedFileModuleItems.length === 0"
          @click="exportModuleJson"
        >
          导出 JSON
        </button>
      </div>
      <input
        v-model="moduleQuery"
        class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text) outline-none transition placeholder:text-(--dashboard-text-soft) focus:border-(--dashboard-accent)"
        placeholder="搜索模块路径或来源"
        type="search"
      >
      <div class="grid grid-cols-2 gap-2">
        <select
          v-model="moduleSourceFilter"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="all">
            全部来源
          </option>
          <option
            v-for="sourceType in moduleSourceOptions"
            :key="sourceType"
            :value="sourceType"
          >
            {{ sourceType }}
          </option>
        </select>
        <select
          v-model="moduleSortMode"
          class="h-9 min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        >
          <option value="saving">
            按可节省
          </option>
          <option value="size">
            按体积
          </option>
          <option value="duplicates">
            按复用包
          </option>
          <option value="source">
            按路径
          </option>
        </select>
      </div>
    </div>
    <ul class="grid min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
      <AppEmptyState v-if="selectedFileModuleItems.length === 0" as="li" compact>
        选择一个 chunk 文件或调整筛选条件查看模块明细。
      </AppEmptyState>
      <AppCompactListItem
        v-for="item in selectedFileModuleItems"
        :key="item.key"
        :meta="item.meta"
        mono-title
        :title="item.title"
        :value="item.value"
      />
    </ul>
  </section>
</template>
