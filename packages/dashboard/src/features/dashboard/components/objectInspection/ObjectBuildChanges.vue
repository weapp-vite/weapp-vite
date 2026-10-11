<script setup lang="ts">
import type { AnalyzeSubpackagesResult } from '../../types'
import type { InspectionNode } from '../../utils/objectInspection'
import { computed } from 'vue'
import { formatBytes } from '../../utils/format'
import { createInspectionIndex } from '../../utils/objectInspection'

const props = defineProps<{ node: InspectionNode, comparisonResult: AnalyzeSubpackagesResult | null, baselineLabel: string }>()
const baseline = computed(() => props.comparisonResult ? createInspectionIndex(props.comparisonResult).nodes.get(props.node.key) ?? null : null)
const rows = computed(() => {
  const fields = props.node.target.kind === 'module'
    ? [{ key: 'attributedBytes' as const, label: '当前产物中的归因' }, { key: 'sourceBytes' as const, label: '原始源码' }]
    : [{ key: 'rawBytes' as const, label: '原始体积' }, { key: 'gzipBytes' as const, label: 'Gzip 实测' }, { key: 'brotliBytes' as const, label: 'Brotli 实测' }]
  return fields.map(({ key, label }) => {
    const before = baseline.value?.measurements[key] ?? null
    const after = props.node.measurements[key]
    const delta = before === null || after === null ? null : after - before
    return {
      label,
      before: before === null ? '未测量' : formatBytes(before),
      after: after === null ? '未测量' : formatBytes(after),
      delta: delta === null ? '不可比较' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatBytes(Math.abs(delta))}`,
    }
  })
})
</script>

<template>
  <section class="build-changes">
    <h3>构建变化</h3>
    <p v-if="!comparisonResult" class="change-note">未选择基线。请在构建分析中选择真实历史报告，再比较同一对象的测量；源码与产物转换不是构建增量。</p>
    <template v-else>
      <p class="change-note">基线：{{ baselineLabel || '已选择的历史报告' }}<span v-if="comparisonResult.metadata?.generatedAt"> · {{ comparisonResult.metadata.generatedAt }}</span></p>
      <p v-if="!baseline" class="change-note">基线中没有相同身份的对象，可能为新增或路径已改变；不把不存在或缺测当成零。</p>
      <dl v-else class="change-metrics">
        <div v-for="row in rows" :key="row.label" class="change-metric">
          <dt>{{ row.label }}</dt>
          <dd><span>基线 {{ row.before }}</span><span>当前 {{ row.after }}</span><strong>{{ row.delta }}</strong></dd>
        </div>
      </dl>
      <p class="change-note">只比较同一包、产物与模块身份的同口径测量。变化不自动证明某次修改有效。</p>
    </template>
  </section>
</template>

<style scoped>
.build-changes h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 550;
}

.change-note {
  margin: 12px 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--dashboard-text-muted);
}

.change-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin: 18px 0;
}

.change-metric {
  padding: 12px;
  background: var(--dashboard-panel);
  border: 1px solid var(--dashboard-border);
  border-radius: 6px;
}

.change-metric dt {
  font-size: 13px;
  color: var(--dashboard-text-muted);
}

.change-metric dd {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.change-metric strong {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 500;
}
</style>
