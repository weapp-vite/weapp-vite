<script setup lang="ts">
import type { TreemapModuleNodeMeta } from '../../types'
import type { DiagnosticEvidence } from '../../utils/diagnosticEvidence'
import { formatBytes, formatSourceType } from '../../utils/format'

defineProps<{
  evidence: DiagnosticEvidence
}>()

const emit = defineEmits<{
  openSource: [meta: TreemapModuleNodeMeta]
}>()
</script>

<template>
  <section aria-label="报告中的模块与来源" class="@container/source-evidence min-w-0 border-t border-(--dashboard-border) pt-6">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="font-mono text-sm font-medium text-(--dashboard-text)">
        模块与来源
      </h3>
      <span data-source-count class="text-xs tabular-nums text-(--dashboard-text-soft)">展示 {{ evidence.sources.length }} / {{ evidence.sourceCount }} 项 · 最多 16 项</span>
    </header>
    <p class="mt-3 text-sm leading-6 text-(--dashboard-text-muted)">
      报告关联不等于导入链；打开来源后需核对当前源码与构建时刻的差异。
    </p>
    <p v-if="evidence.sources.length === 0" class="mt-6 text-sm leading-6 text-(--dashboard-text-soft)">
      当前条目没有可定位的来源模块。没有来源记录不代表没有依赖；请先补齐模块报告或核对资源本身。
    </p>
    <ul v-else class="mt-6 divide-y divide-(--dashboard-border)">
      <li v-for="source in evidence.sources" :key="source.id" class="source-evidence-row grid min-w-0 gap-3 py-4 first:pt-0">
        <div class="min-w-0">
          <div class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span class="text-xs text-(--dashboard-text-soft)">{{ formatSourceType(source.meta.sourceType) }}</span>
            <span class="text-xs tabular-nums text-(--dashboard-text-muted)">
              模块体积 {{ source.bytes === null ? '未知' : formatBytes(source.bytes) }}
            </span>
          </div>
          <button
            v-if="source.readable"
            type="button"
            data-diagnostic-open-source
            class="mt-1 inline-flex min-h-9 max-w-full items-start gap-2 rounded-sm py-1 text-left font-mono text-xs leading-6 text-(--dashboard-accent) underline decoration-(--dashboard-border-strong) underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11"
            :aria-label="`打开来源 ${source.meta.source}，${source.meta.packageLabel} / ${source.meta.fileName}`"
            @click="emit('openSource', source.meta)"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]">{{ source.meta.source }}</span>
            <span class="icon-[mdi--arrow-top-right] mt-1 size-4 shrink-0" aria-hidden="true" />
          </button>
          <div v-else data-diagnostic-unreadable-source class="mt-2">
            <code class="block font-mono text-xs leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ source.meta.source }}</code>
            <p class="mt-1 text-xs leading-5 text-(--dashboard-text-soft)">
              {{ source.meta.sourceType === 'node_modules' ? '依赖源码需在外部工作区核实。' : '未提供可导航的源码映射，需在外部工作区核实。' }}
            </p>
          </div>
        </div>
        <dl class="grid content-start gap-1 text-xs leading-5 text-(--dashboard-text-muted)">
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
  </section>
</template>

<style scoped>
@container source-evidence (min-width: 40rem) {
  .source-evidence-row {
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    column-gap: 2rem;
  }
}
</style>
