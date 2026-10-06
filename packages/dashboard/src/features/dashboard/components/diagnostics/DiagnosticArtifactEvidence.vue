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

const sourcePreview = computed(() => props.evidence.sources.slice(0, 3))
const sourceScale = computed(() => {
  let maximum: number | null = null
  for (const source of sourcePreview.value) {
    if (source.bytes !== null) {
      maximum = Math.max(maximum ?? 0, source.bytes)
    }
  }
  return maximum
})

function sourceName(source: string) {
  const identifier = formatModuleIdentifier(source)
  return identifier.slice(identifier.lastIndexOf('/') + 1)
}
</script>

<template>
  <div class="@container/artifact-evidence min-w-0">
    <div class="artifact-evidence-grid grid min-w-0 border-y border-(--dashboard-border)">
      <section aria-label="体积测量对照" class="artifact-measurements min-w-0 py-4">
        <header class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-medium text-(--dashboard-text)">
            体积对照
          </h3>
          <span class="text-xs text-(--dashboard-text-soft) [overflow-wrap:anywhere]">{{ comparisonLabel }}</span>
        </header>
        <div class="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-(--dashboard-text-soft)">
          <span class="min-w-0 [overflow-wrap:anywhere]">{{ evidence.scopeLabel }}</span>
          <span>同一字节尺度</span>
        </div>
        <dl class="mt-3 grid gap-3">
          <div v-for="row in measurements" :key="row.key" :data-measurement="row.key" class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-baseline gap-x-3 gap-y-1.5">
            <dt class="text-xs text-(--dashboard-text-muted) [overflow-wrap:anywhere]">
              {{ row.label }}
            </dt>
            <dd class="min-w-0 text-right font-mono tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]" :class="row.key === 'current' ? 'text-xl font-medium' : 'text-sm'">
              {{ row.bytes === null ? '未知 / 未提供' : formatBytes(row.bytes) }}
            </dd>
            <dd class="col-span-2" aria-hidden="true">
              <span class="block h-3 bg-(--dashboard-panel-muted)" :class="row.bytes === null ? 'border border-dashed border-(--dashboard-border)' : ''">
                <span
                  v-if="row.width !== null && row.bytes !== 0"
                  class="block h-full"
                  :class="row.key === 'current' ? 'bg-(--dashboard-accent)' : row.key === 'limit' ? 'bg-(--dashboard-text-muted)' : 'bg-(--dashboard-border-strong)'"
                  :style="{ width: row.width }"
                />
              </span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-baseline gap-3 border-t border-(--dashboard-border) pt-3">
            <dt class="text-xs text-(--dashboard-text-muted)">
              {{ evidence.measurement === 'upper-bound' ? '上界较基线变化' : '较基线变化' }}
            </dt>
            <dd class="min-w-0 text-right font-mono text-lg font-medium tabular-nums text-(--dashboard-text) [overflow-wrap:anywhere]">
              {{ evidence.deltaBytes === null ? '未知' : formatSignedBytes(evidence.deltaBytes) }}
            </dd>
          </div>
        </dl>
        <p v-if="evidence.measurement === 'upper-bound'" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          上界不是可移除体积或已实现收益。
        </p>
        <p v-else-if="evidence.measurement === 'unavailable'" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          测量不完整，不能判断预算达标。
        </p>
        <p v-if="evidence.currentBytes === null || evidence.previousBytes === null" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
          {{ evidence.previousBytes === null ? '基线未提供或缺测；' : '' }}未知不按 0 计算。
        </p>

        <section aria-label="关联产物" class="mt-4 min-w-0 border-t border-(--dashboard-border) pt-3">
          <header class="flex flex-wrap items-baseline justify-between gap-2">
            <h4 class="text-xs font-medium text-(--dashboard-text)">
              关联产物
            </h4>
            <span data-artifact-count class="text-xs tabular-nums text-(--dashboard-text-soft)">展示 {{ evidence.artifacts.length }} / {{ evidence.artifactCount }} 项 · 最多 12 项</span>
          </header>
          <p v-if="evidence.artifacts.length === 0" class="mt-3 text-sm leading-6 text-(--dashboard-text-muted)">
            当前报告没有可定位的关联产物。
          </p>
          <details v-else :key="evidence.scopeLabel" class="mt-1">
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

      <section aria-label="关联来源摘要" class="artifact-sources min-w-0 border-t border-(--dashboard-border) py-4">
        <header class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-medium text-(--dashboard-text)">
            来源贡献
          </h3>
          <span class="text-xs tabular-nums text-(--dashboard-text-soft)">摘要 {{ sourcePreview.length }} / {{ evidence.sourceCount }} 项</span>
        </header>
        <p v-if="sourcePreview.length === 0" class="mt-4 text-sm leading-6 text-(--dashboard-text-soft)">
          暂无可定位来源；需补齐模块报告或核对资源。
        </p>
        <p v-if="sourcePreview.length" class="mt-3 text-xs leading-5 text-(--dashboard-text-soft)">
          {{ sourceScale === null ? '来源体积未提供' : '条长参照：摘要内最大已知来源' }}
          <span v-if="sourceScale !== null" class="font-mono tabular-nums">{{ formatBytes(sourceScale) }}</span>
        </p>
        <ul v-if="sourcePreview.length" class="mt-2 divide-y divide-(--dashboard-border)">
          <li v-for="source in sourcePreview" :key="source.id" class="min-w-0">
            <details class="group min-w-0" data-source-detail>
              <summary :title="formatModuleIdentifier(source.meta.source)" :aria-label="`查看来源 ${formatModuleIdentifier(source.meta.source)}，${source.meta.packageLabel} 的关联详情`" class="min-h-11 cursor-pointer list-none rounded-sm py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)">
                <span class="flex min-w-0 items-baseline gap-2">
                  <span class="icon-[mdi--chevron-right] size-3 shrink-0 self-center text-(--dashboard-text-soft) group-open:rotate-90" aria-hidden="true" />
                  <code class="min-w-0 flex-1 font-mono text-xs leading-5 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ sourceName(source.meta.source) }}</code>
                  <span class="shrink-0 font-mono text-sm tabular-nums text-(--dashboard-text)">{{ source.bytes === null ? '未知' : formatBytes(source.bytes) }}</span>
                </span>
                <span class="mt-1 block truncate pl-5 text-xs leading-4 text-(--dashboard-text-soft)">{{ source.meta.packageLabel }}</span>
                <span class="mt-2 block h-1.5 bg-(--dashboard-panel-muted)" :class="source.bytes === null ? 'border border-dashed border-(--dashboard-border)' : ''" aria-hidden="true">
                  <span
                    v-if="source.bytes !== null && source.bytes > 0 && sourceScale !== null && sourceScale > 0"
                    class="block h-full bg-(--dashboard-accent)"
                    :style="{ width: `${source.bytes / sourceScale * 100}%` }"
                  />
                </span>
              </summary>
              <dl class="grid min-w-0 gap-2 pb-3 pl-5 text-xs leading-5 text-(--dashboard-text-muted)">
                <div>
                  <dt class="text-(--dashboard-text-soft)">来源 · {{ formatSourceType(source.meta.sourceType) }}</dt>
                  <dd class="font-mono [overflow-wrap:anywhere]">{{ formatModuleIdentifier(source.meta.source) }}</dd>
                </div>
                <div>
                  <dt class="text-(--dashboard-text-soft)">所属包</dt>
                  <dd class="[overflow-wrap:anywhere]">{{ source.meta.packageLabel }}</dd>
                </div>
                <div>
                  <dt class="text-(--dashboard-text-soft)">关联产物</dt>
                  <dd class="font-mono [overflow-wrap:anywhere]">{{ source.meta.fileName }}</dd>
                </div>
              </dl>
            </details>
          </li>
        </ul>
        <p v-if="sourcePreview.length" class="mt-3 text-xs leading-5 text-(--dashboard-text-soft)">
          仅为报告关联，贡献不可相加，也不等于可节省量。
        </p>
        <button
          type="button"
          class="mt-2 inline-flex min-h-9 max-w-full items-center gap-2 rounded-sm py-1.5 text-left text-xs text-(--dashboard-accent) [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11"
          @click="emit('showSources')"
        >
          查看模块与来源
          <span class="icon-[mdi--arrow-right] size-4 shrink-0" aria-hidden="true" />
        </button>
        <details v-if="evidence.constraints.length" class="mt-3 border-t border-(--dashboard-border) pt-1">
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
