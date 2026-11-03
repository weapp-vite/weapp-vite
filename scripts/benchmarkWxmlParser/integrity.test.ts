import type { Fixture, MeasurementResult, Operation, Sample } from './types'
import { describe, expect, it } from 'vitest'
import { CORE_OPERATIONS } from './contracts'
import { assertIntegrity, assertPassed } from './integrity'
import { percentile, summarize } from './statistics'
import { createWorkload } from './workload'

const fixture: Fixture = { id: 'fixture', sha256: 'source-hash', bytes: 8, origins: ['fixture.wxml'], source: '{{data}}', platform: 'weapp', cohort: 'shared', size: 'small', features: ['interpolation'] }
const operations: Operation[] = CORE_OPERATIONS.map(id => ({ id, comparable: id !== 'preserve-noop', run: () => undefined }))

function completeResult(selected = operations, files = [fixture]): MeasurementResult {
  const manifest = createWorkload(selected, files, false, selected.map(operation => operation.id))
  const samples: Sample[] = []
  for (const operation of selected) {
    for (const cohort of manifest.cohorts) {
      for (let round = 0; round < 40; round++) {
        const order = round % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const
        for (const arm of order) {
          samples.push({ operation: operation.id, cohort: cohort.id, round, arm, phase: 'primary', durationMs: arm === 'baseline' ? 100 : operation.comparable ? 90 : 0, iterations: 10, documents: cohort.documents, bytes: cohort.bytes })
        }
      }
    }
  }
  return {
    manifest,
    samples,
    errors: [],
    summaries: selected.flatMap(operation => manifest.cohorts.map(cohort => summarize(samples, operation, cohort.id, 40))),
    parity: selected.flatMap(operation => files.map(file => ({ operation: operation.id, fixture: file.id, cohort: file.cohort, equal: true, baseline: 'same', candidate: 'same' }))),
  }
}

describe('frozen WXML workload integrity', () => {
  it('uses the shared paired helper median for even-sized batches', () => {
    expect(percentile([1, 100], 0.5)).toBe(50.5)
    expect(() => assertPassed(completeResult())).not.toThrow()
  })

  it.each(['canonical', 'parse-edit-serialize'])('rejects a missing entire %s operation', (operation) => {
    const result = completeResult()
    result.samples = result.samples.filter(row => row.operation !== operation)
    result.summaries = result.summaries.filter(row => row.operation !== operation)
    result.parity = result.parity.filter(row => row.operation !== operation)
    expect(() => assertPassed(result)).toThrow()
  })

  it('rejects missing feature cells, a missing parity result, and altered external plans', () => {
    const cell = completeResult()
    cell.summaries = cell.summaries.filter(row => row.cohort !== 'shared-interpolation')
    expect(() => assertPassed(cell)).toThrow('cells')
    const parity = completeResult()
    parity.parity.pop()
    expect(() => assertPassed(parity)).toThrow('parity')
    const different = completeResult()
    const expected = structuredClone(different.manifest!)
    different.manifest!.cohorts.pop()
    expect(() => assertPassed(different, expected)).toThrow('manifest')
  })

  it('recomputes a saved passed summary from raw measurements', () => {
    const result = completeResult()
    for (const row of result.samples) {
      if (row.operation === 'parse' && row.arm === 'candidate') {
        row.durationMs = 110
      }
    }
    expect(() => assertPassed(result)).toThrow()
  })

  it('rejects duplicate rounds, changed paired workloads, and extra confirmations', () => {
    const duplicate = completeResult()
    duplicate.samples[2]!.round = 0
    expect(() => assertPassed(duplicate)).toThrow('paired')
    const iterations = completeResult()
    iterations.samples[1]!.iterations = 9
    expect(() => assertPassed(iterations)).toThrow('paired')
    const confirmation = completeResult()
    confirmation.samples.push({ ...confirmation.samples[0]!, phase: 'confirmation' })
    expect(() => assertPassed(confirmation)).toThrow('confirmation')
  })

  it('rejects missing core operations before timing can begin', () => {
    expect(() => createWorkload(operations.slice(1), [fixture], false)).toThrow('operation')
    expect(() => createWorkload([...operations, operations[0]!], [fixture], false)).toThrow('operation')
  })

  it('records and enforces the raw tree, common range and original-source edit contract', () => {
    const result = completeResult()
    expect(result.manifest!.contract).toBe('wxml-paired-v4-full-real-wxml-gates')
    expect(result.manifest!.performance).toEqual({ aggregateCohorts: ['shared', 'real-all'], aggregateMaximumRegressionPercent: 0, categoryMaximumRegressionPercent: 5, informationalOperations: ['preserve-noop'] })
    expect(result.manifest!.parsing).toMatchObject({
      parseEntities: 'raw',
      parseRanges: 'utf16-half-open-common-nodes',
      editTextSelector: 'first-nonblank-original-source-text-excluding-cdata',
    })
    result.manifest = structuredClone(result.manifest!)
    Object.assign(result.manifest.parsing, { parseEntities: 'decoded' })
    expect(() => assertPassed(result)).toThrow('manifest')
  })

  it('rejects shared semantic differences and forged parity in exploratory runs too', () => {
    const changed = completeResult()
    changed.parity[0] = { ...changed.parity[0]!, candidate: 'changed', equal: false }
    expect(() => assertIntegrity(changed)).toThrow('semantic')
    changed.parity[0]!.equal = true
    expect(() => assertIntegrity(changed)).toThrow('parity')
    const flags = completeResult()
    flags.manifest!.operations[0]!.comparable = false
    expect(() => assertPassed(flags)).toThrow('manifest')
  })

  const consumers: Operation[] = ['scanner', 'web', 'simulator'].map(name => ({ id: `consumer-${name}`, comparable: true, run: () => undefined }))
  const allOperations = [...operations, ...consumers]

  it('requires the same eight-operation Node and browser matrix', () => {
    const node = completeResult(allOperations)
    const browser = completeResult(allOperations)
    expect(node.manifest!.operations).toHaveLength(8)
    expect(browser.manifest).toEqual(node.manifest)
    expect(() => assertPassed(browser, node.manifest)).not.toThrow()
    expect(() => assertPassed(completeResult(), node.manifest)).toThrow('manifest')
    expect(() => createWorkload(operations, [fixture], false, allOperations.map(operation => operation.id))).toThrow('operation')
  })

  it.each(consumers.map(operation => operation.id))('rejects incomplete paired consumer evidence for %s', (id) => {
    const expected = completeResult(allOperations).manifest!
    const operation = completeResult(allOperations)
    operation.samples = operation.samples.filter(row => row.operation !== id)
    operation.summaries = operation.summaries.filter(row => row.operation !== id)
    operation.parity = operation.parity.filter(row => row.operation !== id)
    expect(() => assertPassed(operation, expected)).toThrow()
    const feature = completeResult(allOperations)
    feature.summaries = feature.summaries.filter(row => row.operation !== id || row.cohort !== 'shared-interpolation')
    expect(() => assertPassed(feature, expected)).toThrow('cells')
    const pair = completeResult(allOperations)
    const index = pair.samples.findIndex(row => row.operation === id && row.arm === 'candidate')
    pair.samples.splice(index, 1)
    expect(() => assertPassed(pair, expected)).toThrow('samples')
    const parity = completeResult(allOperations)
    parity.parity = parity.parity.filter(row => row.operation !== id)
    expect(() => assertPassed(parity, expected)).toThrow('parity')
  })

  it('does not allow consumers to become informational', () => {
    const changed = allOperations.map(operation => ({ ...operation, comparable: operation.id === 'consumer-web' ? false : operation.comparable }))
    expect(() => createWorkload(changed, [fixture], false, changed.map(operation => operation.id))).toThrow('Consumer')
    const result = completeResult(allOperations)
    result.manifest!.operations.find(operation => operation.id === 'consumer-web')!.comparable = false
    expect(() => assertPassed(result)).toThrow('manifest')
  })

  it('requires real-all even when a self-reported manifest and all its cells omit it', () => {
    const result = completeResult(allOperations)
    result.manifest!.cohorts = result.manifest!.cohorts.filter(cohort => cohort.id !== 'real-all')
    result.samples = result.samples.filter(sample => sample.cohort !== 'real-all')
    result.summaries = result.summaries.filter(summary => summary.cohort !== 'real-all')
    expect(() => assertPassed(result)).toThrow('real-all')
  })

  it('binds the complete real-all member order and bytes while excluding synthetic inputs', () => {
    const wxml: Fixture = { ...fixture, id: 'wxml', sha256: 'wxml', bytes: 20, cohort: 'wxml' }
    const synthetic: Fixture = { ...fixture, id: 'stress', sha256: 'stress', synthetic: true, pressureId: 'stress-fixed' }
    const result = completeResult(allOperations, [fixture, synthetic, wxml])
    const aggregate = result.manifest!.cohorts.at(-1)!
    expect(aggregate).toEqual({ id: 'real-all', fixtureIds: ['fixture', 'wxml'], documents: 2, bytes: 28 })
    expect(result.parity).toHaveLength(24)
    expect(() => assertPassed(result)).not.toThrow()
    aggregate.fixtureIds.reverse()
    expect(() => assertPassed(result)).toThrow('real-all')
  })

  it('retains raw WXML oracle differences while enforcing their speed gate', () => {
    const wxml: Fixture = { ...fixture, id: 'wxml', sha256: 'wxml', cohort: 'wxml' }
    const result = completeResult(allOperations, [fixture, wxml])
    const difference = result.parity.find(row => row.operation === 'consumer-web' && row.fixture === wxml.id)!
    Object.assign(difference, { equal: false, baseline: 'old WXML interpretation', candidate: 'new WXML interpretation' })
    expect(() => assertPassed(result)).not.toThrow()
    for (const sample of result.samples) {
      if (sample.operation === 'consumer-web' && sample.cohort === 'wxml' && sample.arm === 'candidate') {
        sample.durationMs = 120
      }
    }
    const primary = result.samples.filter(sample => sample.operation === 'consumer-web' && sample.cohort === 'wxml')
    result.samples.push(...primary.map(sample => ({ ...sample, phase: 'confirmation' as const })))
    result.summaries = allOperations.flatMap(operation => result.manifest!.cohorts.map(cohort => summarize(result.samples, operation, cohort.id, 40)))
    expect(() => assertPassed(result)).toThrow('consumer-web:wxml')
    expect(difference).toMatchObject({ equal: false, baseline: 'old WXML interpretation', candidate: 'new WXML interpretation' })
  })

  it('rejects historical v3 or weakened performance contracts instead of reinterpreting them', () => {
    const historical = completeResult()
    Object.assign(historical.manifest!, { contract: 'wxml-paired-v3-raw-tree-source-edits' })
    expect(() => assertPassed(historical)).toThrow('manifest')
    const changed = completeResult()
    changed.manifest = structuredClone(changed.manifest!)
    Object.assign(changed.manifest.performance, { aggregateMaximumRegressionPercent: 5 })
    expect(() => assertPassed(changed)).toThrow('manifest')
  })
})
