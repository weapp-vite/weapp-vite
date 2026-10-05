<script setup lang="ts">
import type { WorkspaceCommandItem } from '../types'
import { useWorkspaceCommandCenter } from '../composables/useWorkspaceCommandCenter'
import AppEmptyState from './AppEmptyState.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppSelect from './AppSelect.vue'
import AppToolButton from './AppToolButton.vue'

const props = defineProps<{
  commands: WorkspaceCommandItem[]
}>()

const {
  categoryFilter,
  categoryLabels,
  categoryOptions,
  categoryTones,
  commandSummary,
  copiedCommand,
  copyCommand,
  failedCommand,
  filteredCommands,
  searchQuery,
  selectedCommand,
  selectedCommandValue,
} = useWorkspaceCommandCenter(props)
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
            <AppSelect
              v-model="categoryFilter"
              label="筛选命令分类"
              :options="categoryOptions"
            />
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

            <AppToolButton
              :label="`复制命令 ${command.command}${copiedCommand === command.command ? '（已复制）' : failedCommand === command.command ? '（复制失败）' : ''}`"
              icon-name="metric-copy"
              touch-label="复制"
              @click="copyCommand(command.command)"
            />
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

        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <AppToolButton
            :label="`复制命令 ${selectedCommand.command}`"
            icon-name="metric-copy"
            touch-label="复制"
            @click="copyCommand(selectedCommand.command)"
          />
          <span
            v-if="copiedCommand === selectedCommand.command || failedCommand === selectedCommand.command"
            class="text-sm font-medium text-(--dashboard-text)"
          >
            {{ copiedCommand === selectedCommand.command ? '已复制' : '复制失败' }}
          </span>
        </div>
      </div>
    </aside>
  </div>
</template>
