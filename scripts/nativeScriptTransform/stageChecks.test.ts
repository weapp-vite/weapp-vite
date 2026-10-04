import type { OptimizedScenario } from '../optimizedCompilerAnalysis/scenarios'
import type { OptimizedCheck } from '../optimizedCompilerAnalysis/verify'
import type { TransformScriptCaptureRecord } from './captureTypes'
import type { StageVariant } from './stageChecks'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { expectedHookSources } from '../optimizedCompilerAnalysis/verify'
import { scriptBaselineSources } from '../scriptAnalysisBaseline/installHelpers/source'
import { createCaptureBridgeMetrics, serializeCaptureValue } from './captureSerialize'
import { captureTarget } from './captureSource'
import { digest } from './identity'
import { verifyStageReport } from './stageChecks'

const scenarios: OptimizedScenario[] = [
  { scenario: { id: 'raw-first', kind: 'script', source: 'export const first = 1', filename: 'src/first.ts', options: {} } },
  { scenario: { id: 'raw-second', kind: 'script', source: 'export const second = 2', filename: 'src/second.ts', options: {} } },
  { scenario: { id: 'sfc-wevu', kind: 'sfc', source: '<script setup>const value = 1</script>', filename: 'src/example.vue', options: {} } },
  { scenario: { id: 'template-only', kind: 'sfc', source: '<template><view /></template>', filename: 'src/template.vue', options: {} } },
  { scenario: { id: 'reserved-only', kind: 'reserved-props', source: 'const value = 1', filename: 'src/reserved.ts' } },
]
const sourceHashes = Object.fromEntries([
  ...scriptBaselineSources,
  'packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/bindingManifest.ts',
  'packages-runtime/wevu-compiler/src/plugins/vue/compiler/template.ts',
  'packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/elements/tag-slot.ts',
].map(filename => [filename, digest(filename)]))

function stageRecord(scenarioId: string, callIndex: number): TransformScriptCaptureRecord {
  const code = `export const value = '${scenarioId}'`
  const bridge = createCaptureBridgeMetrics()
  const options = serializeCaptureValue({ classStyleBindings: [{ expAst: { type: 'Identifier', name: 'value', start: 0, end: 5 } }] }, {
    inputOptions: true,
    expressions: { isExpression: node => !!node && typeof node === 'object' && 'type' in node, generate: () => ({ code: 'value' }) },
    metrics: bridge,
  })
  return { schemaVersion: 1, scenarioId, callIndex, source: { code, sha256: digest(code), utf16Length: code.length, utf8Bytes: Buffer.byteLength(code) }, options, bridge, fastSetup: 'miss', status: 'returned', warnings: [], captureFailures: [], result: serializeCaptureValue({ code, transformed: true, map: { version: 3, mappings: 'AAAA', names: [], sources: ['inline.ts'] } }) }
}

function fixture(variant: StageVariant = 'captured-optimized-js') {
  const compilerVariant = variant === 'baseline' ? 'baseline' : 'optimized-js'
  const expected = new Map<string, string>()
  const records: TransformScriptCaptureRecord[] = []
  const checks: Array<OptimizedCheck & { capturedCallIndexes?: number[] }> = []
  for (const [scenarioIndex, { scenario }] of scenarios.entries()) {
    const value = scenario.kind === 'script'
      ? { code: 'compiled', transformed: true, map: null }
      : scenario.kind === 'sfc' ? { script: 'compiled', template: '<view />' } : undefined
    const output = JSON.stringify({ value, warnings: [], consoleWarnings: [] })
    expected.set(scenario.id, output)
    for (const iteration of [0, 1]) {
      const capturedCallIndexes: number[] = []
      if (scenarioIndex < 3) {
        capturedCallIndexes.push(records.length)
        records.push(stageRecord(scenario.id, records.length))
      }
      checks.push({ scenario: scenario.id, iteration, inputSha256: digest(JSON.stringify(scenario)), output, failed: false, warnings: [], metrics: variant === 'baseline'
        ? {}
        : { activeCompiles: 0, pendingTransfers: 0, astAlreadyConsumed: 0, astReuse: 1, astSourceMismatch: 1, astUnavailable: 1, propsNoScopeVisits: 1, pageMetaSkipped: 1, pageMetaAnalyzed: 1, reservedSkipped: 1, reservedAnalyzed: 1 }, bindingMetrics: variant === 'baseline' ? {} : { activeTemplates: 0, pendingRecords: 0, pendingInputs: 0, fallbackReasons: [], fallbackCount: 0 }, ...(variant === 'captured-optimized-js' ? { capturedCallIndexes } : {}) })
    }
  }
  const report = { schemaVersion: 1, variant, passed: true, sourcesUnchanged: true, sourceHashes, hookSources: expectedHookSources(compilerVariant, sourceHashes), cleanupErrors: [], checks, capture: variant === 'captured-optimized-js' ? { records, loader: { target: captureTarget, loadCount: 1, upstreamSha256: digest('optimized'), instrumentedSha256: digest('captured') } } : undefined }
  return { report, expected, records, verify: () => verifyStageReport(report, variant, sourceHashes, scenarios, expected) }
}

describe('actual stage capture report ownership and comparison', () => {
  it.each(['baseline', 'optimized-js', 'captured-optimized-js'] as const)('accepts complete %s evidence and legitimate zero-stage scenarios', (variant) => {
    const setup = fixture(variant)
    const result = setup.verify()
    expect(result.checks).toHaveLength(10)
    expect(result.records).toHaveLength(variant === 'captured-optimized-js' ? 6 : 0)
  })

  it('builds the baseline oracle from its first round and still checks the second round', () => {
    const setup = fixture('baseline')
    setup.expected.clear()
    setup.verify()
    expect(setup.expected.size).toBe(scenarios.length)
    setup.report.checks[1].output = JSON.stringify({ value: { code: 'different', transformed: true }, warnings: [], consoleWarnings: [] })
    expect(() => setup.verify()).toThrow('observer changed full output')
  })

  it.each(['missing-property', 'missing-raw-call', 'missing-wevu-call'] as const)('rejects %s capture ownership', (mode) => {
    const setup = fixture()
    if (mode === 'missing-property') {
      delete setup.report.checks[0].capturedCallIndexes
    }
    else {
      setup.report.checks[mode === 'missing-raw-call' ? 0 : 4].capturedCallIndexes = []
    }
    expect(() => setup.verify()).toThrow('Missing per-call capture ownership')
  })

  it.each(['duplicate', 'cross-scenario', 'out-of-order'] as const)('rejects %s stage references', (mode) => {
    const setup = fixture()
    if (mode === 'duplicate') {
      setup.report.checks[1].capturedCallIndexes = [0]
    }
    else if (mode === 'cross-scenario') {
      setup.report.checks[0].capturedCallIndexes = [2]
    }
    else {
      setup.report.checks[0].capturedCallIndexes = [1]
    }
    expect(() => setup.verify()).toThrow('missing, duplicated or owned by another call')
  })

  it('rejects a missing record even if all surviving global callIndexes are renumbered', () => {
    const setup = fixture()
    setup.records.splice(1, 1)
    setup.records.forEach((record, index) => {
      record.callIndex = index
    })
    expect(() => setup.verify()).toThrow('missing, duplicated or owned by another call')
  })

  it('rejects a record assigned to the wrong existing scenario', () => {
    const setup = fixture()
    setup.records[0].scenarioId = scenarios[1].scenario.id
    expect(() => setup.verify()).toThrow('owned by another call')
  })

  it('rejects additional records absent from every per-call ownership list', () => {
    const setup = fixture()
    setup.records.push(stageRecord(scenarios[0].scenario.id, setup.records.length))
    expect(() => setup.verify()).toThrow('Unowned captured records remain')
  })

  it.each(['source', 'options', 'result', 'warnings', 'fastSetup'] as const)('rejects repeated stage %s drift even when complete compiler output matches', (field) => {
    const setup = fixture()
    const record = setup.records[1]
    if (field === 'source') {
      const code = 'changed source'
      record.source = { code, sha256: digest(code), utf16Length: code.length, utf8Bytes: Buffer.byteLength(code) }
    }
    else if (field === 'options') {
      record.options = serializeCaptureValue({ sourceMap: false })
    }
    else if (field === 'result') {
      record.result = serializeCaptureValue({ code: 'changed output', transformed: true, map: null })
    }
    else if (field === 'warnings') {
      record.warnings.push({ channel: 'console', arguments: serializeCaptureValue(['changed warning']) })
    }
    else {
      record.fastSetup = 'hit'
    }
    expect(() => setup.verify()).toThrow('Repeated stage requests/results/warnings changed')
  })

  it.each(['code', 'map', 'warning'] as const)('rejects public %s drift against the unobserved baseline', (field) => {
    const setup = fixture()
    const warnings = field === 'warning' ? ['new warning'] : []
    setup.report.checks[0].warnings = warnings
    setup.report.checks[0].output = JSON.stringify({ value: { code: field === 'code' ? 'changed' : 'compiled', transformed: true, map: field === 'map' ? { mappings: 'AAAA' } : null }, warnings, consoleWarnings: [] })
    expect(() => setup.verify()).toThrow('observer changed full output/maps/warnings/diagnostics')
  })

  it('rejects capture evidence attached to an unobserved control worker', () => {
    const setup = fixture('optimized-js')
    setup.report.capture = fixture().report.capture
    expect(() => setup.verify()).toThrow('Control variant unexpectedly captured')
  })
})
