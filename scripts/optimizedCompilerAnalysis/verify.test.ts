import type { OptimizedScenario } from './scenarios'
import type { OptimizedCheck } from './verify'
import { describe, expect, it } from 'vitest'
import { digest } from './identity'
import { verifyOptimizedCheck, verifyScriptCoverage } from './verify'

const entry: OptimizedScenario = {
  scenario: { id: 'binding-example', kind: 'sfc', source: '<template>{{ value }}</template>', filename: 'src/example.vue', options: {} },
  bindingCoverage: 'batched',
}

function check(): OptimizedCheck {
  return {
    scenario: entry.scenario.id,
    iteration: 0,
    inputSha256: digest(JSON.stringify(entry.scenario)),
    output: '{"value":{"script":"compiled"},"warnings":[],"consoleWarnings":[]}',
    failed: false,
    warnings: [],
    metrics: { activeCompiles: 0, pendingTransfers: 0, astAlreadyConsumed: 0, astReuse: 1 },
    bindingMetrics: {
      activeTemplates: 0,
      pendingRecords: 0,
      pendingInputs: 0,
      nativeCalls: 1,
      fallbackCount: 0,
      fallbackReasons: [],
      inputCount: 2,
      uniqueInputCount: 1,
      consumedInputs: 2,
      queuedRecords: 1,
      flushCount: 1,
      baseJsCalls: 0,
    },
  }
}

describe('composed compiler evidence', () => {
  it('accepts a completed native batch on the optimized script baseline', () => {
    expect(verifyOptimizedCheck(check(), entry, 'optimized-native', 0).bindingMetrics.nativeCalls).toBe(1)
  })

  it.each([
    ['input drift', (value: OptimizedCheck) => { value.inputSha256 = '0'.repeat(64) }],
    ['iteration drift', (value: OptimizedCheck) => { value.iteration = 1 }],
    ['lost native coverage', (value: OptimizedCheck) => { value.bindingMetrics.nativeCalls = 0 }],
    ['unexpected fallback', (value: OptimizedCheck) => { value.bindingMetrics.fallbackCount = 1 }],
    ['binding residue', (value: OptimizedCheck) => { value.bindingMetrics.pendingRecords = 1 }],
    ['script residue', (value: OptimizedCheck) => { value.metrics.pendingTransfers = 1 }],
    ['reused AST', (value: OptimizedCheck) => { value.metrics.astAlreadyConsumed = 1 }],
    ['unexpected error', (value: OptimizedCheck) => { value.failed = true }],
    ['missing output', (value: OptimizedCheck) => { value.output = '' }],
    ['empty compiler output', (value: OptimizedCheck) => { value.output = '{"value":{},"warnings":[],"consoleWarnings":[]}' }],
    ['missing compiler invocation', (value: OptimizedCheck) => { value.output = '{"warnings":[],"consoleWarnings":[]}' }],
    ['unserialized warning', (value: OptimizedCheck) => { value.warnings = ['lost'] }],
    ['missing warning channel', (value: OptimizedCheck) => { value.output = '{"value":{"script":"compiled"},"warnings":[]}' }],
    ['invalid output JSON', (value: OptimizedCheck) => { value.output = 'invalid' }],
  ] as const)('rejects %s', (_label, mutate) => {
    const value = check()
    mutate(value)
    expect(() => verifyOptimizedCheck(value, entry, 'optimized-native', 0)).toThrow()
  })

  it('requires exactly one deliberate batch fallback', () => {
    const value = check()
    const fault = { ...entry, nativeFault: 'throw' as const }
    expect(() => verifyOptimizedCheck(value, fault, 'optimized-native', 0)).toThrow('fallback')
    value.bindingMetrics.fallbackCount = 1
    value.bindingMetrics.fallbackReasons = ['Error: Injected native execution failure']
    expect(verifyOptimizedCheck(value, fault, 'optimized-native', 0)).toBe(value)
    value.bindingMetrics.fallbackCount = 2
    expect(() => verifyOptimizedCheck(value, fault, 'optimized-native', 0)).toThrow('fallback')
  })

  it('requires direct owner insertion and separate scoped slot consumption', () => {
    const value = check()
    const slot = { ...entry, bindingCoverage: 'scoped-slots' as const }
    value.bindingMetrics.directRecords = 1
    value.bindingMetrics.flushCount = 1
    expect(() => verifyOptimizedCheck(value, slot, 'optimized-native', 0)).toThrow('slot consumption')
    value.bindingMetrics.flushCount = 2
    expect(verifyOptimizedCheck(value, slot, 'optimized-native', 0)).toBe(value)
  })

  it('rejects an optimized script implementation without conservative guard branch coverage', () => {
    expect(() => verifyScriptCoverage([check()], 'optimized-native')).toThrow('astSourceMismatch')
  })

  it('rejects native work in the JS summary reference', () => {
    expect(() => verifyOptimizedCheck(check(), entry, 'optimized-summary', 0)).toThrow('JS variant invoked native')
  })

  it.each(['inputCount', 'uniqueInputCount', 'consumedInputs', 'queuedRecords', 'flushCount', 'baseJsCalls'])('requires the JS summary to exercise %s', (metric) => {
    const value = check()
    value.bindingMetrics.nativeCalls = 0
    value.bindingMetrics.baseJsCalls = 1
    expect(verifyOptimizedCheck(value, entry, 'optimized-summary', 0)).toBe(value)
    value.bindingMetrics[metric] = 0
    expect(() => verifyOptimizedCheck(value, entry, 'optimized-summary', 0)).toThrow()
  })

  it.each(['optimized-summary', 'optimized-native'] as const)('checks eager JSX and separate slot consumption in %s', (variant) => {
    const value = check()
    value.bindingMetrics.nativeCalls = variant === 'optimized-native' ? 1 : 0
    value.bindingMetrics.baseJsCalls = variant === 'optimized-summary' ? 1 : 0
    expect(() => verifyOptimizedCheck(value, { ...entry, bindingCoverage: 'eager' }, variant, 0)).toThrow('eager JSX')
    value.bindingMetrics.unbatchedCalls = 1
    expect(verifyOptimizedCheck(value, { ...entry, bindingCoverage: 'eager' }, variant, 0)).toBe(value)
    const slot = { ...entry, bindingCoverage: 'scoped-slots' as const }
    expect(() => verifyOptimizedCheck(value, slot, variant, 0)).toThrow('slot consumption')
    value.bindingMetrics.flushCount = 2
    value.bindingMetrics.directRecords = 1
    expect(verifyOptimizedCheck(value, slot, variant, 0)).toBe(value)
  })

  it('rejects missing or unrelated fault diagnostics even when fallbackCount is one', () => {
    const value = check()
    value.bindingMetrics.fallbackCount = 1
    const fault = { ...entry, nativeFault: 'malformed' as const }
    expect(() => verifyOptimizedCheck(value, fault, 'optimized-native', 0)).toThrow('fallback diagnostics')
    value.bindingMetrics.fallbackReasons = ['Error: unrelated binding fault']
    expect(() => verifyOptimizedCheck(value, fault, 'optimized-native', 0)).toThrow('did not cause fallback')
    value.bindingMetrics.fallbackReasons = ['Error: Native batch result length differs from unique input count']
    expect(verifyOptimizedCheck(value, fault, 'optimized-native', 0)).toBe(value)
  })

  it('requires public diagnostics for expected failures and an actual transform result for raw scripts', () => {
    const value = check()
    value.failed = true
    const failure = { ...entry, scenario: { ...entry.scenario, expectError: true } }
    value.inputSha256 = digest(JSON.stringify(failure.scenario))
    expect(() => verifyOptimizedCheck(value, failure, 'optimized-native', 0)).toThrow()
    value.output = '{"error":{"name":"SyntaxError","message":"invalid expression"},"warnings":[],"consoleWarnings":[]}'
    expect(verifyOptimizedCheck(value, failure, 'optimized-native', 0)).toBe(value)
    const raw: OptimizedScenario = { scenario: { ...entry.scenario, kind: 'script', options: {} } }
    value.failed = false
    value.inputSha256 = digest(JSON.stringify(raw.scenario))
    value.output = '{"value":{"code":"compiled"},"warnings":[],"consoleWarnings":[]}'
    expect(() => verifyOptimizedCheck(value, raw, 'optimized-native', 0)).toThrow('no generated output')
    value.output = '{"value":{"code":"compiled","transformed":true},"warnings":[],"consoleWarnings":[]}'
    expect(verifyOptimizedCheck(value, raw, 'optimized-native', 0)).toBe(value)
  })
})
