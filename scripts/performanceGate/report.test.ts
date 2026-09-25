import type { AuditBatch } from './report'
import { describe, expect, it } from 'vitest'
import { autoImportMetrics } from './autoImport'
import { evaluateGate } from './evaluate'
import { autoImportFeatureCosts } from './featureCosts'
import { assertManifestMetrics } from './manifest'
import { pairBatch } from './report'

function makeBatch(): AuditBatch {
  return { errors: [], samples: Array.from({ length: 7 }, (_, round) => (['baseline', 'optimized'] as const).map(side => ({
    round,
    side,
    values: ['manual', 'automatic'].map(mode => ({ id: `auto-build:1:${mode}:first`, template: 'auto-import-1', phase: 'first', ms: mode === 'manual' ? 100 : 130 })),
  }))).flat() }
}

describe('performance comparison dimensions', () => {
  it('does not mistake feature overhead for a cross-commit regression', () => {
    const batch = makeBatch()
    expect(evaluateGate(pairBatch(batch)).status).toBe('passed')
    expect(autoImportFeatureCosts(batch)[0]).toMatchObject({ extraMs: 30, extraPercent: 30, overFeatureBudget: false })
    expect(autoImportFeatureCosts({ samples: [], errors: [] })[0]).toMatchObject({ extraMs: null, extraPercent: null, overFeatureBudget: null })
  })
  it('rejects duplicated pairs instead of increasing confidence', () => {
    const batch = makeBatch()
    batch.samples[2]!.round = 0
    expect(evaluateGate(pairBatch(batch)).status).toBe('incomplete')
  })
  it('requires every declared four-group metric and rejects duplicates', () => {
    const metrics = autoImportMetrics()
    const manifest = { templates: [], metrics }
    expect(metrics).toHaveLength(48)
    expect(() => assertManifestMetrics(manifest, metrics)).not.toThrow()
    expect(() => assertManifestMetrics(manifest, metrics.slice(1))).toThrow('Missing')
    expect(() => assertManifestMetrics(manifest, [metrics[1]!, ...metrics.slice(1)])).toThrow('Missing')
  })
})
