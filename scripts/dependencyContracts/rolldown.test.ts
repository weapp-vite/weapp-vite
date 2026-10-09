import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { completeContractReport, contractNames, normalizeReport, parseContractArguments } from './rolldown/helpers.mjs'

function completedObservations() {
  return {
    status: 'running',
    results: contractNames.map(name => ({ name, status: 'passed', result: { observed: true }, durationMs: 0 })),
  }
}

describe('Rolldown contract entry arguments', () => {
  it('resolves the requested report file without accepting an external dependency path', () => {
    expect(parseContractArguments(['--report', 'contracts.json'])).toEqual({ reportFile: path.resolve('contracts.json') })
  })

  it.each([
    [],
    ['--report'],
    ['--report', ''],
    ['--report', '   '],
    ['--report', '--suite'],
    ['--suite', 'hooks'],
    ['--report', 'contracts.json', '--expect-released'],
    ['--package', 'external-rolldown'],
  ])('rejects missing reports and contract bypass options: %j', (...args) => {
    expect(() => parseContractArguments(args)).toThrow()
  })
})

describe('Rolldown contract completion', () => {
  it('completes only after all mandatory observations pass', () => {
    const report = completedObservations()
    const completed = completeContractReport(report)
    expect(completed.status).toBe('passed')
    expect(completed.results).toBe(report.results)
    expect(report.status).toBe('running')
  })

  it('rejects partial, duplicate, failed, unobserved, and already failed reports', () => {
    const partial = completedObservations()
    partial.results.pop()
    const duplicate = completedObservations()
    duplicate.results[1] = duplicate.results[0]!
    const failed = completedObservations()
    failed.results[0]!.status = 'failed'
    const unobserved = completedObservations()
    Object.assign(unobserved.results[0]!, { result: undefined })
    const invalidDuration = completedObservations()
    invalidDuration.results[0]!.durationMs = Number.NaN
    for (const report of [
      partial,
      duplicate,
      failed,
      unobserved,
      invalidDuration,
      { ...completedObservations(), status: 'failed' },
      { ...completedObservations(), error: { message: 'cleanup failed' } },
    ]) {
      expect(() => completeContractReport(report)).toThrow()
    }
  })
})

it('normalizes fixture locations while preserving runtime and memory diagnostic values', () => {
  const root = path.join(tmpdir(), 'contract-report-fixture')
  const report = {
    input: [path.join(root, 'watch', 'entry.js')],
    error: { message: `failed in ${path.join(root, 'watch', 'entry.js')}` },
    result: { value: 43, durationMs: 4.2, live: false, bytes: 97, pattern: String.raw`^\w+$` },
  }
  expect(normalizeReport(report, root)).toEqual({
    input: ['<fixture>/watch/entry.js'],
    error: { message: 'failed in <fixture>/watch/entry.js' },
    result: report.result,
  })
  expect(report.input).toEqual([path.join(root, 'watch', 'entry.js')])
})
