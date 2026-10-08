import type { SemanticCoverage, SemanticExecution, SemanticWorkerRequest } from './types'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { digest } from '../identity'
import { compareSemanticExecutions, verifySemanticExecution } from './results'
import { snapshotSemanticValue } from './value'

function fixture() {
  const request: SemanticWorkerRequest = { schemaVersion: 1, scenarioId: 'example', filename: 'example.mjs', code: 'import { register } from "host"; export default register({});' }
  const coverage: SemanticCoverage = { inlineIds: ['tap'], computedKeys: ['label'], lifecycleNames: ['onLoad'], requiredAssertions: ['registered'] }
  const observation = {
    assertions: [{ id: 'registered', passed: true as const, actual: snapshotSemanticValue({ registered: 1 }) }],
    inlineInvocations: [{ id: 'tap', executions: 1 }],
    computedInvocations: [{ id: 'label', executions: 1 }],
    lifecycleInvocations: [{ id: 'onLoad', executions: 1 }],
  }
  const result: SemanticExecution = {
    schemaVersion: 1,
    scenarioId: request.scenarioId,
    loadedCodeSha256: digest(request.code),
    loadedCodeUtf16Length: request.code.length,
    loadedCodeUtf8Bytes: Buffer.byteLength(request.code),
    passed: true,
    imports: [{ specifier: 'host', exports: ['register'], dynamic: false }],
    exports: ['default'],
    coverage,
    assertions: structuredClone(observation.assertions),
    inlineInvocations: ['tap'],
    computedInvocations: ['label'],
    lifecycleInvocations: ['onLoad'],
    observation: snapshotSemanticValue(observation),
    trace: [{ label: 'module:evaluated', payload: { type: 'undefined' } }],
    async: [],
    pending: [],
    unhandledErrors: [],
    cleanup: { attempted: false, completed: true, errors: [] },
    dependencyFiles: ['package/entry.js'],
  }
  return { request, coverage, result, observation }
}

describe('semantic worker evidence validation', () => {
  it('accepts an exact loaded module and truthfully records an optional absent cleanup hook', () => {
    const { request, coverage, result } = fixture()
    expect(verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toBe(result)
    expect(result.cleanup.attempted).toBe(false)
  })

  it('resolves shared observation references while preserving private snapshot types and cycles', () => {
    const { request, coverage, result, observation } = fixture()
    const privateValue: Record<string, unknown> = {
      error: new Error('outer', { cause: new TypeError('inner') }),
      // eslint-disable-next-line no-sparse-arrays -- 覆盖私有观察值的稀疏数组快照。
      values: [undefined, , -0, Number.NaN, 2n, Symbol('private'), () => {}],
    }
    privateValue.self = privateValue
    result.observation = snapshotSemanticValue({ aEarlier: observation, ...observation, privateValue })
    expect(verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toBe(result)
  })

  it.each([true, { type: 'undefined' }, { type: 'object', id: 0, properties: [] }])('rejects an empty or invalid successful observation: %j', (observation) => {
    const { request, coverage, result } = fixture()
    expect(() => verifySemanticExecution({ ...result, observation }, request, coverage, result.dependencyFiles, 0)).toThrow()
  })

  it('rejects observation assertions that differ from the top-level actual values', () => {
    const { request, coverage, result, observation } = fixture()
    observation.assertions[0]!.actual = snapshotSemanticValue({ registered: 0 })
    result.observation = snapshotSemanticValue(observation)
    expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow('assertions differ')
  })

  it.each(['inlineInvocations', 'computedInvocations', 'lifecycleInvocations'] as const)('rejects missing, unexecuted, reordered or inconsistent %s observations', (field) => {
    for (const mutation of ['missing', 'unexecuted', 'different', 'extra', 'reordered'] as const) {
      const { request, coverage, result, observation } = fixture()
      if (mutation === 'missing') {
        observation[field] = []
      }
      if (mutation === 'unexecuted') {
        observation[field][0]!.executions = 0
      }
      if (mutation === 'different') {
        observation[field][0]!.id = 'another'
      }
      if (mutation === 'extra') {
        result[field].push(result[field][0]!)
      }
      if (mutation === 'reordered') {
        result[field].push('later')
        observation[field].push({ id: 'later', executions: 1 })
        observation[field].reverse()
      }
      result.observation = snapshotSemanticValue(observation)
      expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow()
    }
  })

  it('rejects unresolved references and duplicate object identities or property names', () => {
    for (const mutation of ['reference', 'identity', 'property'] as const) {
      const { request, coverage, result } = fixture()
      const observation = result.observation!
      expect(observation.type).toBe('object')
      if (observation.type !== 'object') {
        throw new Error('Invalid test fixture')
      }
      if (mutation === 'reference') {
        observation.properties.push(['broken', { type: 'reference', id: 999 }])
      }
      if (mutation === 'identity') {
        observation.properties.push(['broken', { type: 'object', id: 0, properties: [] }])
      }
      if (mutation === 'property') {
        observation.properties.push(observation.properties[0]!)
      }
      expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow()
    }
  })

  it('requires exactly one module evaluation event', () => {
    for (const count of [0, 2]) {
      const { request, coverage, result } = fixture()
      result.trace = Array.from({ length: count }, () => ({ label: 'module:evaluated', payload: { type: 'undefined' } }))
      expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow('module evaluation evidence')
    }
  })

  it('rejects a report for different code and an exit status hiding failure', () => {
    const { request, coverage, result } = fixture()
    expect(() => verifySemanticExecution(result, { ...request, code: `${request.code}\n` }, coverage, result.dependencyFiles, 0)).toThrow('different module')
    expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 1)).toThrow('exit status')
  })

  it('rejects successful claims with missing independent assertions or actual call coverage', () => {
    for (const field of ['assertions', 'inlineInvocations', 'computedInvocations', 'lifecycleInvocations'] as const) {
      const { request, coverage, result } = fixture()
      result[field] = []
      expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow()
    }
  })

  it('rejects a false idle claim and failed cleanup disguised as success', () => {
    const { request, coverage, result } = fixture()
    result.async.push({ id: 1, label: 'service', status: 'pending' })
    expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow('pending count')
    result.pending.push('service')
    expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow('hides an error')
    result.async = []
    result.pending = []
    result.cleanup.completed = false
    expect(() => verifySemanticExecution(result, request, coverage, result.dependencyFiles, 0)).toThrow('hides an error')
  })

  it('rejects equal failed executions and detects a changed observation or call order', () => {
    const { result } = fixture()
    const failure = { ...result, passed: false, failure: { type: 'string' as const, value: 'both failed' } }
    expect(compareSemanticExecutions(failure, structuredClone(failure)).comparisonPassed).toBe(false)
    const actual = structuredClone(result)
    actual.trace.push({ label: 'unexpected-call', payload: { type: 'undefined' } })
    expect(compareSemanticExecutions(result, actual)).toEqual({ comparisonPassed: false, differentFields: ['trace'] })
    actual.trace = structuredClone(result.trace)
    actual.observation = { type: 'undefined' }
    expect(compareSemanticExecutions(result, actual).differentFields).toEqual(['observation'])
  })
})
