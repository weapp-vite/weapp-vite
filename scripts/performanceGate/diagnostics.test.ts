import type { FailureReason } from './diagnostics'
import type { GateSummary } from './evaluate'
import { expect, it } from 'vitest'
import { createShardDiagnostics, renderShardDiagnostics } from './diagnostics'
import { evaluateGate } from './evaluate'

const shard = 'hmr:stateful-experimental:native'
const gate = evaluateGate([{ id: `${shard}:script:first:edit`, requiredPairs: 1, pairs: [{ baseline: 100, current: 100 }] }])

it('counts raw runtime observations independently of profile availability for each batch and side', () => {
  const primary = { errors: [], samples: [
    { side: 'baseline', values: [{ id: `${shard}:script:first:edit`, runtimeBefore: 'stateful', runtimeAfter: 'stateful' }] },
    { side: 'optimized', values: [{ id: `${shard}:script:first:edit`, runtimeBefore: 'standard', runtimeAfter: 'standard', profilePipeline: 'standard' }] },
  ] }
  const diagnostics = createShardDiagnostics({ shard, primary, confirmation: primary, gate, featureCosts: [] })
  expect(diagnostics.runtimeSummary).toMatchObject({
    requestedRuntime: 'stateful-experimental',
    unit: 'metric-observations',
    primary: {
      baseline: { observations: 1, runtimeBefore: { stateful: 1 }, runtimeAfter: { stateful: 1 }, profilePipeline: { unknown: 1 } },
      optimized: { observations: 1, runtimeBefore: { standard: 1 }, runtimeAfter: { standard: 1 }, profilePipeline: { standard: 1 } },
    },
  })
  expect(diagnostics.runtimeSummary?.confirmation).toEqual(diagnostics.runtimeSummary?.primary)
  expect(diagnostics.failureReasons).toEqual([])
  expect(renderShardDiagnostics(diagnostics)).toContain('按每个场景阶段的产物观测计数')
  expect(renderShardDiagnostics(diagnostics)).toContain('实际管线不同仍按原门槛比较')
})

it('preserves unknown historical runtime fields and does not infer them from the requested runtime', () => {
  const primary = { errors: [], samples: [{ side: 'baseline', values: [{ id: `${shard}:script:first:edit`, profilePipeline: 'unexpected' }] }] }
  const result = createShardDiagnostics({ shard, primary, gate, featureCosts: [] })
  expect(result.runtimeSummary?.primary.baseline).toEqual({ observations: 1, runtimeBefore: { standard: 0, stateful: 0, unknown: 1 }, runtimeAfter: { standard: 0, stateful: 0, unknown: 1 }, profilePipeline: { standard: 0, stateful: 0, unknown: 1 } })
  expect(renderShardDiagnostics(result)).toContain('unknown（无观测）')
  expect(createShardDiagnostics({ shard: 'build', primary, gate, featureCosts: [] }).runtimeSummary).toBeUndefined()
})

it('keeps comparison states, collection ownership, stop reasons and both budget sides distinct', () => {
  const compared: GateSummary = { ...gate, status: 'regression', scenarios: ['regression', 'unstable', 'incomplete'].map((status, index) => ({ ...gate.scenarios[0]!, id: `scenario-${index}`, status: status as GateSummary['status'] })) }
  const primary = { samples: [], errors: ['primary pair 9 baseline: patch batch timeout', 'optimized: current output missing', 'preparation failed'], stop: { reason: 'cleanup-unconfirmed' as const, resourcesReleased: false, cancelled: false } }
  const confirmation = { samples: [], errors: ['confirmation hmr:classic: pair 14 optimized: output missing'] }
  const featureCosts = [
    { side: 'baseline', id: 'auto-build:1:manual:repeat', extraMs: 512, changePercent: 29.44, overFeatureBudget: true },
    { side: 'optimized', kind: 'auto-hmr', count: 20, phase: 'first:edit', extraMs: 400, extraPercent: 30, overFeatureBudget: true },
  ]
  const result = createShardDiagnostics({ shard, primary, confirmation, gate: compared, featureCosts })
  expect(result.failureReasons).toEqual(expect.arrayContaining([
    { kind: 'collection', batch: 'primary', side: 'baseline', round: 9, message: primary.errors[0] },
    { kind: 'collection', batch: 'primary', side: 'optimized', message: primary.errors[1] },
    { kind: 'collection', batch: 'primary', side: 'unknown', message: primary.errors[2] },
    { kind: 'collection', batch: 'confirmation', side: 'optimized', round: 14, message: confirmation.errors[0] },
    { kind: 'collector-stop', batch: 'primary', reason: 'cleanup-unconfirmed', resourcesReleased: false },
    { kind: 'feature-budget', side: 'baseline', scenario: 'auto-build:1:manual:repeat', extraMs: 512, extraPercent: 29.44 },
    { kind: 'feature-budget', side: 'optimized', scenario: 'auto-hmr:20:manual:first:edit', extraMs: 400, extraPercent: 30 },
  ]))
  const rendered = renderShardDiagnostics(result)
  for (const status of ['regression', 'unstable', 'incomplete']) {
    expect(rendered).toContain(`跨提交比较 ${status}`)
  }
  expect(rendered).toContain('采集失败 primary / baseline / pair 9')
  expect(rendered).toContain('功能预算越线 baseline')
  expect(compared.status).toBe('regression')
})

it('renders raw error text as inline diagnostic content while retaining the complete evidence', () => {
  const message = 'baseline: <script>|`bad`\noriginal detail'
  const reasons: FailureReason[] = [{ kind: 'collection', batch: 'primary', side: 'baseline', message }]
  const rendered = renderShardDiagnostics({ failureReasons: reasons })
  expect(rendered).toContain('&lt;script&gt;\\|\\`bad\\`')
  expect(rendered).not.toContain('original detail')
  expect(reasons[0]).toMatchObject({ message })
})
