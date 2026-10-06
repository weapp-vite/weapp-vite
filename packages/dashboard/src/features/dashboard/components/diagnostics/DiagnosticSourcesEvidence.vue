<script setup lang="ts">
import type { TreemapModuleNodeMeta } from '../../types'
import type { DiagnosticEvidence } from '../../utils/diagnosticEvidence'
import { formatBytes, formatSourceType } from '../../utils/format'
import AppEmptyState from '../AppEmptyState.vue'

defineProps<{
  evidence: DiagnosticEvidence
}>()

const emit = defineEmits<{
  openSource: [meta: TreemapModuleNodeMeta]
}>()
</script>

<template>
  <section aria-label="报告中的模块与来源" class="min-w-0">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold text-(--dashboard-text)">
        模块与来源
      </h3>
      <span data-source-count class="text-xs tabular-nums text-(--dashboard-text-soft)">展示 {{ evidence.sources.length }} / {{ evidence.sourceCount }} 项 · 最多 16 项</span>
    </header>
    <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">
      这里只列出报告记录的模块、产物与包归属，不推断导入链。打开来源后仍需核对当前源码与构建时刻的差异。
    </p>
    <AppEmptyState v-if="evidence.sources.length === 0" compact class="mt-4">
      当前条目没有可定位的来源模块。没有来源记录不代表没有依赖；请先补齐模块报告或核对资源本身。
    </AppEmptyState>
    <ul v-else class="mt-4 divide-y divide-(--dashboard-border)">
      <li v-for="source in evidence.sources" :key="source.id" class="min-w-0 py-3 first:pt-0">
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
            {{ source.meta.sourceType === 'node_modules' ? '依赖源码需在外部工作区核实。' : '当前报告未提供可导航的项目源码映射，请在外部工作区核实。' }}
          </p>
        </div>
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
  </section>
</template>
