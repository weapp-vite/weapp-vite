<script setup lang="ts">
import type { AnalyzeActionCenterItem, DashboardMetricCard, LargestFileEntry, PackageInsight, SummaryMetric } from '../types'
import { computed, shallowRef, useId } from 'vue'
import { useAnalyzeOverviewPanel } from '../composables/useAnalyzeOverviewPanel'
import { formatBytes } from '../utils/format'
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
  showAllActions,
  visibleActions,
} = useAnalyzeOverviewPanel(props)

const actionListId = useId()
const sizeDetailsOpen = shallowRef(false)
const contextCards = computed(() => props.cards.filter(card => card.label === '总产物体积' || card.label === '预算告警'))

function handleSizeDetailsToggle(event: Event) {
  sizeDetailsOpen.value = (event.target as HTMLDetailsElement).open
}
</script>

<template>
  <section class="grid min-w-0 content-start gap-5">
    <ReleaseGatePanel
      :gate="releaseGate"
      :copy-status="gateCopyStatus"
      @copy="copyReleaseGateReport"
    />

    <dl v-if="contextCards.length > 0" class="flex flex-wrap gap-x-6 gap-y-2 px-1 text-sm leading-6">
      <div v-for="card in contextCards" :key="card.label" class="flex flex-wrap items-baseline gap-x-2">
        <dt class="text-(--dashboard-text-soft)">
          {{ card.label }}
        </dt>
        <dd class="font-semibold tabular-nums text-(--dashboard-text)">
          {{ card.value }}
        </dd>
      </div>
    </dl>

    <section class="min-w-0 px-1">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-(--dashboard-text)">
          优先处理
        </h2>
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
          @click="emit('copyReport')"
        >
          <span class="h-4 w-4" aria-hidden="true">
            <DashboardIcon name="metric-copy" />
          </span>
          复制评审摘要
        </button>
      </div>

      <p v-if="visibleActions.length === 0" class="py-3 text-sm leading-6 text-(--dashboard-text-soft)">
        当前没有需要立即处理的事项。
      </p>
      <ol v-else :id="actionListId" class="mt-1 divide-y divide-(--dashboard-border)">
        <li v-for="item in visibleActions" :key="item.key" class="min-w-0">
          <button
            type="button"
            class="w-full min-w-0 rounded-sm px-2 py-3 text-left hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
            @click="emit('selectAction', item)"
          >
            <span class="flex flex-wrap items-center justify-between gap-2">
              <span :class="getToneClassName(item.tone)">
                {{ getToneLabel(item.tone) }}
              </span>
              <span v-if="item.value" class="text-sm font-semibold tabular-nums text-(--dashboard-text)">
                {{ item.value }}
              </span>
            </span>
            <span class="mt-2 block text-sm font-semibold leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">
              {{ item.title }}
            </span>
            <span class="mt-1 block text-sm leading-6 text-(--dashboard-text-soft) [overflow-wrap:anywhere]">
              {{ item.meta }}
            </span>
          </button>
        </li>
      </ol>
      <button
        v-if="actionItems.length > 3"
        type="button"
        class="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-(--dashboard-accent) hover:bg-(--dashboard-accent-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
        :aria-expanded="showAllActions"
        :aria-controls="actionListId"
        @click="showAllActions = !showAllActions"
      >
        {{ showAllActions ? '收起为前 3 项' : `查看全部 ${actionItems.length} 项` }}
        <span class="iconify mdi--chevron-down size-4" :class="{ 'rotate-180': showAllActions }" aria-hidden="true" />
      </button>
    </section>

    <div class="min-w-0 divide-y divide-(--dashboard-border) border-t border-(--dashboard-border)">
      <details class="min-w-0">
        <summary class="min-h-11 cursor-pointer rounded-sm px-1 py-3 text-sm font-medium text-(--dashboard-text-muted) hover:text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)">
          全部指标
        </summary>
        <div class="px-1 pt-1 pb-5">
          <DashboardMetricGrid compact :cards="cards" :package-type-summary="packageTypeSummary" />
        </div>
      </details>

      <details class="min-w-0" @toggle="handleSizeDetailsToggle">
        <summary class="min-h-11 cursor-pointer rounded-sm px-1 py-3 text-sm font-medium text-(--dashboard-text-muted) hover:text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)">
          体积明细
        </summary>
        <div v-if="sizeDetailsOpen" class="grid min-w-0 items-start gap-6 px-1 pt-1 pb-5 lg:grid-cols-2">
          <section class="min-w-0">
            <h3 class="text-sm font-semibold text-(--dashboard-text)">
              文件体积排行
            </h3>
            <p v-if="largestFiles.length === 0" class="mt-3 text-sm leading-6 text-(--dashboard-text-soft)">
              当前没有文件体积数据。
            </p>
            <ol v-else class="mt-2 divide-y divide-(--dashboard-border)">
              <li v-for="file in largestFiles" :key="`${file.packageId}:${file.file}`" class="min-w-0">
                <button
                  type="button"
                  class="w-full min-w-0 rounded-sm px-2 py-3 text-left hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
                  @click="emit('selectFile', file)"
                >
                  <span class="block font-mono text-sm font-medium leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">
                    {{ file.file }}
                  </span>
                  <span class="mt-1 block text-sm leading-6 text-(--dashboard-text-soft) [overflow-wrap:anywhere]">
                    {{ file.packageLabel }} · {{ file.type }} · {{ file.moduleCount }} 模块
                  </span>
                  <span class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-6 tabular-nums">
                    <span class="font-semibold text-(--dashboard-text)">{{ formatBytes(file.size) }}</span>
                    <span class="text-(--dashboard-text-soft)">压缩 {{ formatBytes(file.compressedSize) }}</span>
                  </span>
                </button>
              </li>
            </ol>
          </section>

          <section class="min-w-0">
            <h3 class="text-sm font-semibold text-(--dashboard-text)">
              包体分布
            </h3>
            <p v-if="packageOverviewItems.length === 0" class="mt-3 text-sm leading-6 text-(--dashboard-text-soft)">
              当前没有包体数据。
            </p>
            <ol v-else class="mt-2 divide-y divide-(--dashboard-border)">
              <li v-for="item in packageOverviewItems" :key="item.id" class="min-w-0">
                <button
                  type="button"
                  class="w-full min-w-0 rounded-sm px-2 py-3 text-left hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
                  @click="emit('selectPackage', item)"
                >
                  <span class="block text-sm font-semibold leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">
                    {{ item.label }}
                  </span>
                  <span class="mt-1 block text-sm leading-6 text-(--dashboard-text-soft)">
                    {{ item.typeLabel }} · {{ item.fileCount }} 产物 · {{ item.moduleCount }} 模块
                  </span>
                  <span class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-6 tabular-nums">
                    <span class="font-semibold text-(--dashboard-text)">{{ item.sizeLabel }}</span>
                    <span class="text-(--dashboard-text-soft)">{{ item.compressedLabel }}</span>
                  </span>
                  <span class="mt-2 block h-1.5 overflow-hidden rounded-full bg-(--dashboard-accent-soft)" aria-hidden="true">
                    <span class="block h-full rounded-full bg-(--dashboard-accent)" :style="item.shareStyle" />
                  </span>
                </button>
              </li>
            </ol>
          </section>
        </div>
      </details>
    </div>
  </section>
</template>
