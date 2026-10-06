<script setup lang="ts">
import type { LargestFileEntry } from '../../types'
import type { DiagnosticEvidence } from '../../utils/diagnosticEvidence'
import { computed } from 'vue'
import { formatBytes, formatModuleIdentifier, formatSourceType } from '../../utils/format'
import { formatSignedBytes } from '../../utils/sourceCompareSummary'

const props = defineProps<{
  evidence: DiagnosticEvidence
  comparisonLabel: string
}>()

const emit = defineEmits<{
  openFile: [file: LargestFileEntry]
  showSources: []
}>()

const measurements = computed(() => {
  const { currentBytes, previousBytes, limitBytes, measurement } = props.evidence
  const scale = Math.max(currentBytes ?? 0, previousBytes ?? 0, limitBytes ?? 0, 1)
  const values = [
    { key: 'previous', label: '对照基线', bytes: previousBytes },
    { key: 'current', label: measurement === 'upper-bound' ? '估算上界' : '当前报告', bytes: currentBytes },
  ]
  if (limitBytes !== null) {
    values.push({ key: 'limit', label: '预算上限', bytes: limitBytes })
  }
  return values.map(row => ({
    ...row,
    width: row.bytes === null ? null : `${row.bytes / scale * 100}%`,
  }))
})

const sourcePreview = computed(() => props.evidence.sources.slice(0, 3))
</script>

<template>
  <div class="@container/artifact-evidence min-w-0">
    <div class="artifact-evidence-grid grid min-w-0 border-y border-(--dashboard-border)">
      <section aria-label="体积测量对照" class="artifact-measurements min-w-0 py-6">
        <header class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="font-mono text-sm font-medium text-(--dashboard-text)">
            01 / 体积对照
          </h3>
          <span class="text-xs text-(--dashboard-text-soft) [overflow-wrap:anywhere]">{{ comparisonLabel }}</span>
        </header>
        <p class="mt-4 text-xs text-(--dashboard-text-soft) [overflow-wrap:anywhere]">
          {{ evidence.scopeLabel }}
        </p>
        <div class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <strong class="font-mono text-[2rem] leading-tight font-medium tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]">
            {{ evidence.currentBytes === null ? '未知' : formatBytes(evidence.currentBytes) }}
          </strong>
          <span class="text-xs text-(--dashboard-text-soft)">
            {{ evidence.measurement === 'upper-bound' ? '当前估算上界' : evidence.currentBytes === null ? '当前测量未提供' : '当前报告' }}
          </span>
        </div>
        <dl class="mt-7 grid gap-5">
          <div v-for="row in measurements" :key="row.key" :data-measurement="row.key" class="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
            <dt class="text-xs text-(--dashboard-text-soft)">
              {{ row.label }}
            </dt>
            <dd class="grid min-w-0 grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 text-right font-mono text-xs tabular-nums text-(--dashboard-text)">
              <span class="block h-6 min-w-0 bg-(--dashboard-panel-muted)" :class="row.bytes === null ? 'border border-dashed border-(--dashboard-border)' : ''" aria-hidden="true">
                <span
                  v-if="row.width !== null && row.bytes !== 0"
                  class="block h-full"
                  :class="row.key === 'current' ? 'bg-(--dashboard-accent)' : row.key === 'limit' ? 'border border-dashed border-(--dashboard-text-muted)' : 'bg-(--dashboard-border-strong)'"
                  :style="{ width: row.width }"
                />
              </span>
              <span class="[overflow-wrap:anywhere]">{{ row.bytes === null ? '未知 / 未提供' : formatBytes(row.bytes) }}</span>
            </dd>
          </div>
        </dl>
        <p class="mt-5 text-xs leading-5 text-(--dashboard-text-muted)">
          相比对照基线
          <strong class="ml-1 font-mono font-medium tabular-nums text-(--dashboard-text)">{{ evidence.deltaBytes === null ? '增量未知' : formatSignedBytes(evidence.deltaBytes) }}</strong>
        </p>
        <p v-if="evidence.measurement === 'upper-bound'" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          当前值为报告估算上界，不代表可移除体积或已实现收益。
        </p>
        <p v-else-if="evidence.measurement === 'unavailable'" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          测量不完整，不能判断预算达标；未知值不按零计算。
        </p>
        <p v-else class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          同一字节尺度；缺失的对照基线不按零计算。
        </p>

        <section aria-label="关联产物" class="mt-6 min-w-0 border-t border-(--dashboard-border) pt-4">
          <header class="flex flex-wrap items-baseline justify-between gap-2">
            <h4 class="text-xs font-medium text-(--dashboard-text)">
              关联产物
            </h4>
            <span data-artifact-count class="text-xs tabular-nums text-(--dashboard-text-soft)">展示 {{ evidence.artifacts.length }} / {{ evidence.artifactCount }} 项 · 最多 12 项</span>
          </header>
          <p v-if="evidence.artifacts.length === 0" class="mt-3 text-sm leading-6 text-(--dashboard-text-muted)">
            当前报告没有可定位的关联产物。
          </p>
          <details v-else :open="evidence.artifacts.length <= 2" class="mt-2">
            <summary class="min-h-9 cursor-pointer rounded-sm py-2 text-xs text-(--dashboard-text-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11">
              产物位置与逐项测量
            </summary>
            <ul class="divide-y divide-(--dashboard-border)">
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
                  <div class="min-w-0">
                    <dt class="text-(--dashboard-text-soft)">基线</dt>
                    <dd class="tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]">{{ artifact.previousBytes === null ? '未知' : formatBytes(artifact.previousBytes) }}</dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-(--dashboard-text-soft)">当前</dt>
                    <dd class="tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]">{{ artifact.bytes === null ? '未知' : formatBytes(artifact.bytes) }}</dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-(--dashboard-text-soft)">变化</dt>
                    <dd class="tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]">{{ artifact.deltaBytes === null ? '未知' : formatSignedBytes(artifact.deltaBytes) }}</dd>
                  </div>
                </dl>
              </li>
            </ul>
          </details>
        </section>
      </section>

      <section aria-label="关联来源摘要" class="artifact-sources min-w-0 border-t border-(--dashboard-border) py-6">
        <header class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="font-mono text-sm font-medium text-(--dashboard-text)">
            02 / 关联来源
          </h3>
          <span class="text-xs tabular-nums text-(--dashboard-text-soft)">摘要 {{ sourcePreview.length }} / {{ evidence.sourceCount }} 项</span>
        </header>
        <p class="mt-4 text-sm leading-6 text-(--dashboard-text-muted)">
          报告记录的模块与归属，不是依赖链。
        </p>
        <p v-if="sourcePreview.length === 0" class="mt-4 text-sm leading-6 text-(--dashboard-text-soft)">
          当前条目没有可定位的来源记录，需补齐模块报告或核对资源本身。
        </p>
        <ul v-else class="mt-4 divide-y divide-(--dashboard-border)">
          <li v-for="source in sourcePreview" :key="source.id" class="min-w-0 py-3 first:pt-0">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-(--dashboard-text-soft)">
              <span>{{ formatSourceType(source.meta.sourceType) }}</span>
              <span class="font-mono tabular-nums">{{ source.bytes === null ? '体积未知' : formatBytes(source.bytes) }}</span>
            </div>
            <code :title="source.meta.source" class="mt-2 block font-mono text-xs leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ formatModuleIdentifier(source.meta.source) }}</code>
            <dl class="mt-2 grid gap-1 text-xs leading-5 text-(--dashboard-text-muted)">
              <div class="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
                <dt class="text-(--dashboard-text-soft)">所属包</dt>
                <dd class="[overflow-wrap:anywhere]">{{ source.meta.packageLabel }}</dd>
              </div>
              <div class="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
                <dt class="text-(--dashboard-text-soft)">产物</dt>
                <dd class="font-mono [overflow-wrap:anywhere]">{{ source.meta.fileName }}</dd>
              </div>
            </dl>
          </li>
        </ul>
        <button
          type="button"
          class="mt-3 inline-flex min-h-10 max-w-full items-center gap-2 rounded-sm py-2 text-left text-sm text-(--dashboard-accent) [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11"
          @click="emit('showSources')"
        >
          查看模块与来源
          <span class="icon-[mdi--arrow-right] size-4 shrink-0" aria-hidden="true" />
        </button>
        <p class="mt-4 border-l-2 border-(--dashboard-border-strong) pl-3 text-xs leading-5 text-(--dashboard-text-soft)">
          关联不证明源码因果；包、产物与模块体积不能相加为优化收益。
        </p>
        <details v-if="evidence.constraints.length" class="mt-4 border-t border-(--dashboard-border) pt-2">
          <summary class="min-h-9 cursor-pointer rounded-sm py-2 text-xs text-(--dashboard-text-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11">
            完整证据边界 · {{ evidence.constraints.length }} 项
          </summary>
          <ul class="mt-2 grid list-disc gap-2 pl-4 text-xs leading-6 text-(--dashboard-text-soft)">
            <li v-for="constraint in evidence.constraints" :key="constraint" class="[overflow-wrap:anywhere]">
              {{ constraint }}
            </li>
          </ul>
        </details>
      </section>
    </div>
  </div>
</template>

<style scoped>
@container artifact-evidence (min-width: 44rem) {
  .artifact-evidence-grid {
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  }

  .artifact-measurements {
    padding-right: 1.5rem;
  }

  .artifact-sources {
    padding-left: 1.5rem;
    border-top: 0;
    border-left: 1px solid var(--dashboard-border);
  }
}
</style>
