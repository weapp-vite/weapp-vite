import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { completeContractReport, normalizeReport, parseContractArguments } from './report.mjs'
import { nonApplicableReason, scenarios } from './scenarios.mjs'

function completedReport(nativePlatform = 'linux') {
  return {
    status: 'running',
    nativePlatform,
    ownership: { scope: 'completed' },
    results: scenarios.map((scenario) => {
      const reason = nonApplicableReason(scenario, nativePlatform)
      return reason
        ? { id: scenario.id, status: 'non-applicable', reason, workerStarted: false, durationMs: 0 }
        : { id: scenario.id, status: 'passed', report: { status: 'passed' }, cleanupConfirmed: true, durationMs: 1 }
    }),
  }
}

describe('Chokidar contract entry', () => {
  it('accepts only a report location and rejects partial or external dependency selection', () => {
    expect(parseContractArguments(['--report', 'contracts.json'])).toEqual({ reportFile: path.resolve('contracts.json') })
    for (const args of [
      [],
      ['--report'],
      ['--report', ''],
      ['--report', ' '],
      ['--report', '--scenario'],
      ['--candidate', 'other/index.js'],
      ['--scenario', scenarios[0]!.id],
      ['--report', 'contracts.json', '--timeout', '1'],
      ['--report', 'contracts.json', '--list'],
    ]) {
      expect(() => parseContractArguments(args)).toThrow()
    }
  })

  it('counts unsupported Windows inode branches separately from passes', () => {
    const windows = completedReport('win32')
    const result = completeContractReport(windows)
    expect(result).toMatchObject({ status: 'passed', planned: scenarios.length, passed: scenarios.length - 4, nonApplicable: 4, failed: 0 })
    const native = completeContractReport(completedReport('darwin'))
    expect(native).toMatchObject({ passed: scenarios.length, nonApplicable: 0 })
    expect(windows.results.filter(item => item.status === 'non-applicable').map(item => item.id)).toEqual([
      'native-inode-rebind-observes-next-change',
      'shared-native-inode-direct-file',
      'shared-native-inode-late-sibling-enoent',
      'shared-native-inode-survivor-after-close',
    ])
    const inode = windows.results.find(item => item.id === 'native-inode-rebind-observes-next-change')!
    expect(inode).toMatchObject({ status: 'non-applicable', workerStarted: false })
    inode.status = 'passed'
    expect(() => completeContractReport(windows)).toThrow()
  })

  it('rejects incomplete, failed, duplicate, unconfirmed, or fake non-applicable results', () => {
    const partial = completedReport()
    partial.results.pop()
    const duplicate = completedReport()
    duplicate.results[1] = duplicate.results[0]!
    const failed = completedReport()
    failed.results[0]!.status = 'failed'
    const unconfirmed = completedReport()
    Object.assign(unconfirmed.results[0]!, { cleanupConfirmed: false })
    const unobserved = completedReport()
    Object.assign(unobserved.results[0]!, { report: undefined })
    const fakeNonApplicable = completedReport()
    fakeNonApplicable.results[0]!.status = 'non-applicable'
    for (const report of [
      partial,
      duplicate,
      failed,
      unconfirmed,
      unobserved,
      fakeNonApplicable,
      { ...completedReport(), ownership: { scope: 'sealed' } },
      { ...completedReport(), error: { message: 'cleanup failed' } },
      { ...completedReport(), status: 'failed' },
    ]) {
      expect(() => completeContractReport(report)).toThrow()
    }
  })
})

it('normalizes persisted paths, including JSON-escaped Windows worker output', () => {
  const root = String.raw`C:\contract-fixture`
  const value = { path: `${root}\\scenario-abc\\src`, stdout: JSON.stringify({ root }), marker: String.raw`^\w+$` }
  expect(normalizeReport(value, [[root, '<fixture>']])).toEqual({
    path: '<fixture>/scenario-abc/src',
    stdout: '{"root":"<fixture>"}',
    marker: String.raw`^\w+$`,
  })
  expect(value.path).toBe(`${root}\\scenario-abc\\src`)
})
