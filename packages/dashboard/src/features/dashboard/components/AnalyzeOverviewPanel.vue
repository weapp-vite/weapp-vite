<script setup lang="ts">
import type { AnalyzeActionCenterItem, DashboardMetricCard, LargestFileEntry, PackageInsight, SummaryMetric } from '../types'
import { useAnalyzeOverviewPanel } from '../composables/useAnalyzeOverviewPanel'
import { formatBytes, formatPackageType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import DashboardIcon from './DashboardIcon.vue'
import DashboardMetricGrid from './DashboardMetricGrid.vue'
import ReleaseGatePanel from './ReleaseGatePanel.vue'

const props = defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  cards: DashboardMetricCard[]
  largestFiles: LargestFileEntry[]
  packageInsights: PackageInsight[]
  packageTypeSummary: SummaryMetric[]
}>()

const emit = defineEmits<{
  copyReport: []
  selectAction: [item: AnalyzeActionCenterItem]
  selectFile: [file: LargestFileEntry]
  selectPackage: [item: PackageInsight]
}>()

const {
  copyReleaseGateReport,
  gateCopyStatus,
  getToneClassName,
  getToneLabel,
  packageOverviewItems,
  releaseGate,
  visibleActions,
  visibleLargestFiles,
} = useAnalyzeOverviewPanel(props)
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2 overflow-hidden">
    <DashboardMetricGrid compact :cards="cards" :package-type-summary="packageTypeSummary" />

    <ReleaseGatePanel
      :gate="releaseGate"
      :copy-status="gateCopyStatus"
      @copy="copyReleaseGateReport"
    />

    <div class="grid min-h-0 gap-2 overflow-hidden xl:grid-cols-[minmax(0,0.95fr)_minmax(0,0.85fr)_minmax(0,0.9fr)]">
      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader icon-name="metric-health" title="处理队列">
          <template #meta>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
              @click="emit('copyReport')"
            >
              <span class="h-3.5 w-3.5">
                <DashboardIcon name="metric-copy" />
              </span>
              复制 PR
            </button>
          </template>
        </AppPanelHeader>

        <div class="mt-3 min-h-0 flex-1 overflow-hidden">
          <AppEmptyState v-if="visibleActions.length === 0" compact>
            当前没有需要立即处理的事项。
          </AppEmptyState>
          <ol v-else class="grid h-full min-h-0 gap-2 overflow-y-auto pr-1">
            <li
              v-for="item in visibleActions"
              :key="item.key"
              class="list-none"
            >
              <button
                type="button"
                class="w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 text-left transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
                @click="emit('selectAction', item)"
              >
                <div class="flex min-w-0 items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex min-w-0 items-center gap-2">
                      <span :class="getToneClassName(item.tone)">
                        {{ getToneLabel(item.tone) }}
                      </span>
                      <p class="truncate text-sm font-medium text-(--dashboard-text)">
                        {{ item.title }}
                      </p>
                    </div>
                    <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
                      {{ item.meta }}
                    </p>
                  </div>
                  <span v-if="item.value" class="shrink-0 whitespace-nowrap text-sm font-semibold text-(--dashboard-accent)">
                    {{ item.value }}
                  </span>
                </div>
              </button>
            </li>
          </ol>
        </div>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader icon-name="top-files" title="Top Files" />
        <ol class="mt-3 grid min-h-0 gap-2 overflow-y-auto pr-1">
          <li
            v-for="file in visibleLargestFiles"
            :key="`${file.packageId}:${file.file}`"
            class="list-none"
          >
            <button
              type="button"
              class="w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 text-left transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
              @click="emit('selectFile', file)"
            >
              <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div class="min-w-0">
                  <p class="truncate font-mono text-xs font-semibold text-(--dashboard-text)">
                    {{ file.file }}
                  </p>
                  <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
                    {{ file.packageLabel }} · {{ formatPackageType(file.packageType) }} · {{ file.type }} · {{ file.moduleCount }} 模块
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold leading-5 text-(--dashboard-accent)">
                    {{ formatBytes(file.size) }}
                  </p>
                  <p class="text-[11px] leading-4 text-(--dashboard-text-soft)">
                    {{ formatBytes(file.compressedSize) }}
                  </p>
                </div>
              </div>
            </button>
          </li>
        </ol>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader icon-name="tab-packages" title="包体分布" />
        <ol class="mt-3 grid min-h-0 gap-2 overflow-y-auto pr-1">
          <li
            v-for="item in packageOverviewItems"
            :key="item.id"
            class="list-none"
          >
            <button
              type="button"
              class="w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2.5 text-left transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
              @click="emit('selectPackage', item)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-(--dashboard-text)">
                    {{ item.label }}
                  </p>
                  <p class="mt-1 text-xs text-(--dashboard-text-soft)">
                    {{ item.typeLabel }} · {{ item.fileCount }} 产物 · {{ item.moduleCount }} 模块
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold text-(--dashboard-text)">
                    {{ item.sizeLabel }}
                  </p>
                  <p class="text-[11px] text-(--dashboard-text-soft)">
                    {{ item.compressedLabel }}
                  </p>
                </div>
              </div>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-(--dashboard-accent-soft)">
                <div class="h-full rounded-full bg-(--dashboard-accent)" :style="item.shareStyle" />
              </div>
            </button>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>
