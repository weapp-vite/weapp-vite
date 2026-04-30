<script setup lang="ts">
import type { DashboardValueOption, WorkspaceCommandCategory, WorkspaceCommandItem } from '../types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppEmptyState from './AppEmptyState.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  commands: WorkspaceCommandItem[]
}>()

type CommandCategoryFilter = 'all' | WorkspaceCommandCategory

const categoryLabels: Record<WorkspaceCommandCategory, string> = {
  dev: '开发',
  build: '构建',
  analyze: '分析',
}

const categoryTones: Record<WorkspaceCommandCategory, 'info' | 'success' | 'warning'> = {
  dev: 'info',
  build: 'success',
  analyze: 'warning',
}

const searchQuery = ref('')
const categoryFilter = ref<CommandCategoryFilter>('all')
const selectedCommandValue = ref<string | null>(null)
const copiedCommand = ref<string | null>(null)
const failedCommand = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

const categoryOptions: DashboardValueOption<CommandCategoryFilter>[] = [
  { value: 'all', label: '全部命令' },
  { value: 'dev', label: categoryLabels.dev },
  { value: 'build', label: categoryLabels.build },
  { value: 'analyze', label: categoryLabels.analyze },
]

const filteredCommands = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()

  return props.commands.filter((command) => {
    if (categoryFilter.value !== 'all' && command.category !== categoryFilter.value) {
      return false
    }

    if (!keyword) {
      return true
    }

    return [
      command.label,
      command.command,
      command.note,
      categoryLabels[command.category],
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const selectedCommand = computed(() =>
  filteredCommands.value.find(command => command.command === selectedCommandValue.value)
  ?? filteredCommands.value[0]
  ?? null,
)

const commandSummary = computed(() => {
  const totalCount = props.commands.length
  const filteredCount = filteredCommands.value.length
  const categoryText = categoryFilter.value === 'all'
    ? '全部'
    : categoryLabels[categoryFilter.value]

  return `匹配 ${filteredCount} / ${totalCount} 条 · ${categoryText}`
})

function clearCopyFeedback() {
  copiedCommand.value = null
  failedCommand.value = null
}

function scheduleCopyFeedbackClear() {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }

  copyFeedbackTimer = setTimeout(() => {
    clearCopyFeedback()
    copyFeedbackTimer = null
  }, 1800)
}

function copyTextWithFallback(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy command failed')
  }
}

async function copyCommand(command: string) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(command)
    }
    else {
      copyTextWithFallback(command)
    }

    copiedCommand.value = command
    failedCommand.value = null
  }
  catch {
    copiedCommand.value = null
    failedCommand.value = command
  }

  scheduleCopyFeedbackClear()
}

watch(filteredCommands, (commands) => {
  if (!commands.some(command => command.command === selectedCommandValue.value)) {
    selectedCommandValue.value = commands[0]?.command ?? null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }
})
</script>

<template>
  <div class="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,0.72fr)]">
    <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div class="grid gap-3 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
        <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_11rem]">
          <label class="grid gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-(--dashboard-text-soft)">
            搜索命令
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索名称、命令或说明"
              class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm normal-case tracking-normal text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
            >
          </label>

          <label class="grid gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-(--dashboard-text-soft)">
            分类
            <select
              v-model="categoryFilter"
              class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-2.5 text-sm normal-case tracking-normal text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
            >
              <option
                v-for="option in categoryOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <p class="text-xs text-(--dashboard-text-soft)">
          {{ commandSummary }}
        </p>
      </div>

      <AppEmptyState v-if="filteredCommands.length === 0" compact>
        当前筛选条件下没有匹配命令。
      </AppEmptyState>

      <div v-else class="grid min-h-0 gap-2 overflow-y-auto pr-1">
        <article
          v-for="command in filteredCommands"
          :key="command.command"
          class="rounded-md border bg-(--dashboard-panel-muted) p-3 transition"
          :class="selectedCommand?.command === command.command ? 'border-(--dashboard-border-strong) bg-(--dashboard-panel)' : 'border-(--dashboard-border)'"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              class="min-w-0 text-left focus:outline-none"
              @click="selectedCommandValue = command.command"
            >
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-(--dashboard-text)">{{ command.label }}</span>
                <AppRuntimeBadge
                  :label="categoryLabels[command.category]"
                  :tone="categoryTones[command.category]"
                />
              </span>
              <span class="mt-1 block text-sm leading-6 text-(--dashboard-text-muted)">
                {{ command.note }}
              </span>
            </button>

            <button
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
              type="button"
              :aria-label="`复制命令 ${command.command}`"
              :title="copiedCommand === command.command ? '已复制' : failedCommand === command.command ? '复制失败' : '复制命令'"
              @click="copyCommand(command.command)"
            >
              <span class="h-4.5 w-4.5">
                <DashboardIcon name="metric-copy" />
              </span>
            </button>
          </div>
        </article>
      </div>
    </div>

    <aside class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] uppercase tracking-[0.2em] text-(--dashboard-accent)">
            Selected
          </p>
          <h3 class="mt-1 text-base font-semibold">
            当前命令
          </h3>
        </div>
        <AppRuntimeBadge
          v-if="selectedCommand"
          :label="categoryLabels[selectedCommand.category]"
          :tone="categoryTones[selectedCommand.category]"
        />
      </div>

      <AppEmptyState v-if="!selectedCommand" compact>
        选择左侧命令后查看复制内容。
      </AppEmptyState>

      <div v-else class="grid min-h-0 content-start gap-3 overflow-y-auto">
        <div>
          <h4 class="font-medium">
            {{ selectedCommand.label }}
          </h4>
          <p class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
            {{ selectedCommand.note }}
          </p>
        </div>

        <code class="block overflow-x-auto rounded-md bg-slate-950 px-3 py-3 font-mono text-xs leading-6 text-slate-100 dark:bg-slate-900">
          {{ selectedCommand.command }}
        </code>

        <button
          type="button"
          class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm font-medium text-(--dashboard-text) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
          @click="copyCommand(selectedCommand.command)"
        >
          <span class="h-4.5 w-4.5">
            <DashboardIcon name="metric-copy" />
          </span>
          {{ copiedCommand === selectedCommand.command ? '已复制' : failedCommand === selectedCommand.command ? '复制失败' : '复制命令' }}
        </button>
      </div>
    </aside>
  </div>
</template>
