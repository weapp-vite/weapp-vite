<script setup lang="ts">
import { cn } from '../../lib/cn'
import { panelSurface, tabButton } from '../../lib/ui'
import { debugTabs } from '../../lib/workbench'
import HighlightedCode from '../HighlightedCode.vue'

defineProps<{
  callableMethodsCount: number
  consoleLines: Array<{ level: string, text: string }>
  consoleSummary: Array<{ level: string, value: string }>
  debugTab: 'wxml' | 'console' | 'appData' | 'sources' | 'network' | 'performance'
  effectiveTheme: 'light' | 'dark'
  pageData: string
  runtimeMetrics: string[][]
  selectedFileContent: string
  selectedFileLanguage: string
  selectedScope: {
    data?: unknown
    methods?: string[]
    scopeId?: string
    scopeType?: string
    type?: string
  } | null
  stringify: (value: unknown) => string
  toastData: string
  currentRoute: string
  wxmlPreviewCode: string
  appData: string
  requestLogData: string
}>()

const emit = defineEmits<{
  toggleDebugTab: [tab: 'wxml' | 'console' | 'appData' | 'sources' | 'network' | 'performance']
}>()

const tabPanelStyles = panelSurface()
</script>

<template>
  <section :class="cn(tabPanelStyles.base(), 'rounded-none border-x-0 border-b-0 shadow-none [grid-template-rows:32px_minmax(0,1fr)]')">
    <div :class="cn(tabPanelStyles.bar(), 'px-0')" role="tablist" aria-label="调试区">
      <button
        v-for="tab in debugTabs"
        :key="tab.value"
        :aria-selected="debugTab === tab.value"
        :class="cn(tabButton({ active: debugTab === tab.value }), 'px-3 py-1.5 text-[11px]')"
        @click="emit('toggleDebugTab', tab.value)"
      >
        <span :class="cn(tab.icon, 'text-[13px]')" aria-hidden="true" />
        {{ tab.label }}
      </button>
      <div class="ml-auto flex items-center gap-2 px-3 text-[color:var(--sim-muted)]">
        <span class="text-[11px]">⚠ 3</span>
        <button class="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[color:var(--sim-pill-hover)]">
          <span class="icon-[mdi--cog-outline] text-[13px]" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div :class="cn(tabPanelStyles.body(), 'grid grid-rows-[minmax(0,1fr)_154px] gap-0 p-0')">
      <section class="grid min-h-0 grid-cols-[minmax(0,1fr)_318px] border-b border-[color:var(--sim-divider)]">
        <div class="grid min-h-0 grid-rows-[28px_minmax(0,1fr)]">
          <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3 text-[11px] text-[color:var(--sim-muted)]">
            <span>{{ currentRoute }}</span>
            <span class="text-[color:var(--sim-text)]">#shadow-root</span>
            <span class="text-[#5aa0ff]">&lt;/{{ currentRoute.split('/').at(-1) || 'page' }}&gt;</span>
          </div>
          <div class="min-h-0 overflow-hidden p-2">
            <HighlightedCode
              v-if="debugTab === 'wxml'"
              :code="wxmlPreviewCode"
              lang="html"
              :theme="effectiveTheme"
            />
            <HighlightedCode
              v-else-if="debugTab === 'appData'"
              :code="appData"
              lang="json"
              :theme="effectiveTheme"
            />
            <HighlightedCode
              v-else-if="debugTab === 'sources'"
              :code="selectedFileContent"
              :lang="selectedFileLanguage"
              :theme="effectiveTheme"
            />
            <HighlightedCode
              v-else-if="debugTab === 'network'"
              :code="requestLogData"
              lang="json"
              :theme="effectiveTheme"
            />
            <div v-else-if="debugTab === 'performance'" class="grid h-full content-start gap-2 p-2">
              <article
                v-for="[label, value] in runtimeMetrics"
                :key="label"
                class="grid gap-1 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] px-3 py-2"
              >
                <span class="text-[10px] uppercase tracking-[0.14em] text-[color:var(--sim-muted)]">{{ label }}</span>
                <strong class="text-[18px] leading-none text-[color:var(--sim-text)]">{{ value }}</strong>
              </article>
            </div>
            <HighlightedCode
              v-else
              :code="selectedScope?.data ? stringify(selectedScope.data) : pageData"
              lang="json"
              :theme="effectiveTheme"
            />
          </div>
        </div>

        <aside class="grid min-h-0 grid-rows-[28px_28px_minmax(0,1fr)] border-l border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)]">
          <div class="flex items-center gap-0.5 border-b border-[color:var(--sim-divider)] px-1 text-[11px]">
            <button class="inline-flex h-7 items-center border-r border-[color:var(--sim-divider)] px-3 text-[color:var(--sim-text)]">
              Styles
            </button>
            <button class="inline-flex h-7 items-center border-r border-[color:var(--sim-divider)] px-3 text-[color:var(--sim-muted)]">
              Computed
            </button>
            <button class="inline-flex h-7 items-center border-r border-[color:var(--sim-divider)] px-3 text-[color:var(--sim-muted)]">
              Dataset
            </button>
            <button class="inline-flex h-7 items-center px-3 text-[color:var(--sim-muted)]">
              Component Data
            </button>
          </div>
          <div class="flex items-center justify-between border-b border-[color:var(--sim-divider)] px-3 text-[11px] text-[color:var(--sim-muted)]">
            <span>Filter</span>
            <span>.cls</span>
          </div>
          <div class="min-h-0 overflow-auto px-3 py-2 text-[11px] leading-5 text-[color:var(--sim-muted)]">
            <div class="border-b border-[color:var(--sim-divider)] pb-2">
              <div class="font-semibold text-[color:var(--sim-text)]">
                {{ selectedScope?.scopeType ?? selectedScope?.type ?? 'page' }}
              </div>
              <div>{{ selectedScope?.scopeId ?? 'page-root' }}</div>
            </div>
            <div class="grid gap-1 py-2">
              <div class="flex items-start justify-between gap-3">
                <span>route</span>
                <span class="text-[color:var(--sim-text)]">{{ currentRoute }}</span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <span>methods</span>
                <span class="text-[color:var(--sim-text)]">{{ selectedScope?.methods?.length ?? callableMethodsCount }}</span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <span>toast</span>
                <span class="truncate text-[color:var(--sim-text)]">{{ JSON.parse(toastData) ? 'visible' : 'idle' }}</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section class="grid min-h-0 grid-cols-[168px_minmax(0,1fr)] bg-[color:var(--sim-panel-soft)]">
        <aside class="border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3 py-2">
          <div class="grid gap-1 text-[11px]">
            <button class="flex items-center justify-between rounded-sm px-2 py-1 text-left text-[color:var(--sim-text)] hover:bg-[color:var(--sim-pill-hover)]">
              <span>Console</span>
              <span class="text-[color:var(--sim-muted)]">1</span>
            </button>
            <button class="flex items-center justify-between rounded-sm px-2 py-1 text-left text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]">
              <span>Task</span>
              <span>0</span>
            </button>
          </div>
          <div class="mt-3 grid gap-1 text-[11px] text-[color:var(--sim-muted)]">
            <div
              v-for="item in consoleSummary"
              :key="item.level"
              class="flex items-center justify-between rounded-sm px-2 py-1"
            >
              <span>{{ item.level }}</span>
              <span>{{ item.value }}</span>
            </div>
          </div>
        </aside>

        <div class="grid min-h-0 grid-rows-[26px_minmax(0,1fr)]">
          <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] px-3 text-[11px] text-[color:var(--sim-muted)]">
            <span class="icon-[mdi--funnel-outline] text-[12px]" aria-hidden="true" />
            <span>Filter</span>
            <span class="ml-auto">Default levels</span>
          </div>
          <div class="min-h-0 overflow-auto text-[11px] leading-5">
            <div
              v-for="(line, index) in consoleLines"
              :key="`${line.level}-${index}`"
              :class="cn(
                'flex items-center gap-2 border-b border-[color:var(--sim-divider)] px-3 py-1.5',
                line.level === 'warn' && 'bg-[color:var(--sim-warn-bg)] text-[color:var(--sim-warn-text)]',
                line.level === 'system' && 'text-[color:var(--sim-text)]',
              )"
            >
              <span
                :class="cn(
                  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase',
                  line.level === 'warn' ? 'bg-[#d7a51d] text-[#1f1600]' : 'bg-[color:var(--sim-pill-bg)] text-[color:var(--sim-muted)]',
                )"
              >
                {{ line.level[0] }}
              </span>
              <span class="truncate">{{ line.text }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
