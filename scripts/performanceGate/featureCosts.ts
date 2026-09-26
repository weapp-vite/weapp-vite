import type { AuditBatch } from './report'
import { autoImportCounts } from './autoImport'
import { percentile } from './evaluate'

/** 同提交手动/自动成本单独列示，不冒充跨提交回退。 */
export function autoImportFeatureCosts(batch: AuditBatch) {
  return (['baseline', 'optimized'] as const).flatMap(side => autoImportCounts.flatMap(count => ['auto-build', 'auto-hmr'].flatMap((kind) => {
    const phases = kind === 'auto-build' ? ['first', 'repeat'] : ['first:edit', 'first:restore', 'repeat:edit', 'repeat:restore']
    return phases.map((phase) => {
      const samples = (mode: string) => batch.samples.filter(row => row.side === side).flatMap(row => row.values).filter(value => value.id === `${kind}:${count}:${mode}:${phase}`).map(value => value.ms)
      const manual = samples('manual')
      const automatic = samples('automatic')
      const before = percentile(manual, 0.5)
      const after = percentile(automatic, 0.5)
      const extraMs = before !== null && after !== null ? after - before : null
      const extraPercent = extraMs !== null && before ? extraMs / before * 100 : null
      return { side, count, kind, phase, samples: { manual: manual.length, automatic: automatic.length }, manualMedianMs: before, automaticMedianMs: after, extraMs, extraPercent, overFeatureBudget: extraMs !== null && extraPercent !== null ? extraMs > 200 && extraPercent > 25 : null }
    })
  })))
}

export function renderFeatureCosts(rows: ReturnType<typeof autoImportFeatureCosts>) {
  const show = (value: number | null) => value === null ? '不可用' : value.toFixed(2)
  return [
    '',
    '## 自动导入启用成本（同提交）',
    '',
    '保留既有功能预算：同时超过 25% 和 200 ms 为越线。下表与跨提交 5% 门禁独立，不用功能预算豁免同配置回退。',
    '',
    '| 提交侧 | 组件数 | 阶段 | 手动 P50 | 自动 P50 | 增量 | 增幅 | 样本 手动/自动 | 功能预算 |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map(row => `| ${row.side} | ${row.count} | ${row.kind}/${row.phase} | ${show(row.manualMedianMs)} ms | ${show(row.automaticMedianMs)} ms | ${show(row.extraMs)} ms | ${show(row.extraPercent)}% | ${row.samples.manual}/${row.samples.automatic} | ${row.overFeatureBudget === null ? '不可比较' : row.overFeatureBudget ? '越线' : '范围内'} |`),
  ].join('\n')
}
