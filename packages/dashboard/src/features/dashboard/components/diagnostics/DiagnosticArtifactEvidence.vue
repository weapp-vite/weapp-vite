<script setup lang="ts">
import type { LargestFileEntry } from '../../types'
import type { DiagnosticEvidence } from '../../utils/diagnosticEvidence'
import { computed } from 'vue'
import { formatBytes } from '../../utils/format'
import { formatSignedBytes } from '../../utils/sourceCompareSummary'
import AppEmptyState from '../AppEmptyState.vue'

const props = defineProps<{
  evidence: DiagnosticEvidence
  comparisonLabel: string
}>()

const emit = defineEmits<{
  openFile: [file: LargestFileEntry]
}>()

const measurements = computed(() => {
  const { currentBytes, previousBytes, limitBytes, measurement } = props.evidence
  const scale = Math.max(currentBytes ?? 0, previousBytes ?? 0, limitBytes ?? 0, 1)
  const values = [
    { key: 'previous', label: '对照基线', bytes: previousBytes },
    { key: 'current', label: measurement === 'upper-bound' ? '当前估算上界' : '当前报告', bytes: currentBytes },
  ]
  if (limitBytes !== null) {
    values.push({ key: 'limit', label: '预算上限', bytes: limitBytes })
  }
  return values.map(row => ({
    ...row,
    width: row.bytes === null ? null : `${row.bytes / scale * 100}%`,
  }))
})
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <div class="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section aria-label="体积测量对照" class="min-w-0">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">
            01 / 体积对照
          </h3>
          <span class="text-xs text-(--dashboard-text-soft) [overflow-wrap:anywhere]">{{ comparisonLabel }}</span>
        </div>
        <p class="mt-2 text-sm text-(--dashboard-text-muted) [overflow-wrap:anywhere]">
          {{ evidence.scopeLabel }}
        </p>
        <dl class="mt-4 grid gap-4">
          <div v-for="row in measurements" :key="row.key" :data-measurement="row.key" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-baseline gap-3">
            <dt class="text-xs text-(--dashboard-text-soft)">
              {{ row.label }}
            </dt>
            <dd class="grid gap-2 text-right text-sm font-medium tabular-nums text-(--dashboard-text)">
              <span>{{ row.bytes === null ? '未知 / 未提供' : formatBytes(row.bytes) }}</span>
              <span v-if="row.width !== null && evidence.measurement === 'file-bytes'" class="block h-2 overflow-hidden rounded-sm bg-(--dashboard-panel-muted)" aria-hidden="true">
                <span
                  class="block h-full rounded-sm"
                  :class="row.key === 'current' ? 'bg-(--dashboard-accent)' : row.key === 'limit' ? 'border border-dashed border-(--dashboard-text-muted)' : 'bg-(--dashboard-border-strong)'"
                  :style="{ width: row.width }"
                />
              </span>
            </dd>
          </div>
        </dl>
        <p class="mt-4 border-t border-(--dashboard-border) pt-3 text-sm text-(--dashboard-text-muted)">
          相比对照基线：
          <strong class="font-medium tabular-nums text-(--dashboard-text)">{{ evidence.deltaBytes === null ? '增量未知' : formatSignedBytes(evidence.deltaBytes) }}</strong>
        </p>
        <p v-if="evidence.measurement === 'upper-bound'" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          当前值为报告口径的估算上界，不是可保证移除的体积；不绘制实测预算图。
        </p>
        <p v-else-if="evidence.measurement === 'unavailable'" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          当前测量不完整，不能判断预算达标；未知值不按零计算。
        </p>
        <p v-else class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          各条使用同一字节尺度。缺失的对照基线不按零计算。
        </p>
      </section>
      <section aria-label="证据边界" class="min-w-0 border-t border-(--dashboard-border) pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5">
        <h3 class="text-sm font-semibold text-(--dashboard-text)">
          02 / 证据边界
        </h3>
        <ul class="mt-3 grid list-disc gap-2 pl-4 text-sm leading-6 text-(--dashboard-text-muted)">
          <li v-for="constraint in evidence.constraints" :key="constraint">
            {{ constraint }}
          </li>
        </ul>
        <p class="mt-4 border-l-2 border-(--dashboard-accent) pl-3 text-xs leading-5 text-(--dashboard-text-soft)">
          构建共现不证明源码因果。包、产物与模块的体积可能重叠，不能相加为优化收益。
        </p>
      </section>
    </div>

    <section aria-label="关联产物" class="min-w-0 border-t border-(--dashboard-border) pt-4">
      <header class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold text-(--dashboard-text)">
          关联产物
        </h3>
        <span data-artifact-count class="text-xs tabular-nums text-(--dashboard-text-soft)">展示 {{ evidence.artifacts.length }} / {{ evidence.artifactCount }} 项 · 最多 12 项</span>
      </header>
      <AppEmptyState v-if="evidence.artifacts.length === 0" compact class="mt-3">
        当前报告没有可定位的关联产物；请先补齐报告与归属证据。
      </AppEmptyState>
      <ul v-else class="mt-2 divide-y divide-(--dashboard-border)">
        <li v-for="artifact in evidence.artifacts" :key="`${artifact.entry.packageId}:${artifact.entry.from}:${artifact.entry.file}`" class="min-w-0 py-3">
          <button
            type="button"
            data-diagnostic-open-file
            class="inline-flex min-h-9 max-w-full items-start gap-2 rounded-sm py-1 text-left font-mono text-xs leading-6 text-(--dashboard-accent) underline decoration-(--dashboard-border-strong) underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11"
            :aria-label="`打开产物 ${artifact.entry.packageLabel} / ${artifact.entry.file}`"
            @click="emit('openFile', artifact.entry)"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]">{{ artifact.entry.file }}</span>
            <span class="icon-[mdi--arrow-top-right] mt-1 size-4 shrink-0" aria-hidden="true" />
          </button>
          <p class="mt-1 text-xs text-(--dashboard-text-soft) [overflow-wrap:anywhere]">
            {{ artifact.entry.packageLabel }} · {{ artifact.entry.type }}
          </p>
          <dl class="mt-2 grid grid-cols-3 gap-2 text-xs leading-5">
            <div>
              <dt class="text-(--dashboard-text-soft)">基线</dt>
              <dd class="tabular-nums text-(--dashboard-text)">{{ artifact.previousBytes === null ? '未知' : formatBytes(artifact.previousBytes) }}</dd>
            </div>
            <div>
              <dt class="text-(--dashboard-text-soft)">当前</dt>
              <dd class="tabular-nums text-(--dashboard-text)">{{ artifact.bytes === null ? '未知' : formatBytes(artifact.bytes) }}</dd>
            </div>
            <div>
              <dt class="text-(--dashboard-text-soft)">变化</dt>
              <dd class="tabular-nums text-(--dashboard-text)">{{ artifact.deltaBytes === null ? '未知' : formatSignedBytes(artifact.deltaBytes) }}</dd>
            </div>
          </dl>
        </li>
      </ul>
    </section>
  </div>
</template>
