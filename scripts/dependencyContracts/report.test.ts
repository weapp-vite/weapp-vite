import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { completeProductReport, createProductReport, failProductReport, parseProductArguments, recordProductResult } from './report.mjs'
import { viteProductContractNames } from './vite/product/inventory.mjs'

function observedReport() {
  return {
    ...createProductReport('vite', viteProductContractNames),
    results: viteProductContractNames.map(name => ({ name, status: 'passed', observations: { observed: true } })),
  }
}

describe('public product inventory and report', () => {
  it('requires the full inventory and only accepts a report path', () => {
    expect(parseProductArguments(['--report', 'product.json'])).toEqual({ reportFile: path.resolve('product.json') })
    for (const args of [[], ['--report'], ['--report', ' '], ['--report', '--skip'], ['--case', 'hooks'], ['--report', 'product.json', '--continue-on-error']]) {
      expect(() => parseProductArguments(args)).toThrow()
    }
    expect(() => createProductReport('vite', [])).toThrow()
    expect(() => createProductReport('vite', ['hooks', 'hooks'])).toThrow()
    expect(Object.isFrozen(viteProductContractNames)).toBe(true)
  })

  it('completes only the public suite and records its exact observed inventory', () => {
    const report = observedReport()
    expect(completeProductReport(report, viteProductContractNames)).toMatchObject({
      suite: 'product-lifecycle',
      status: 'passed',
      planned: viteProductContractNames,
      completed: viteProductContractNames,
      results: report.results,
    })
    expect(report.status).toBe('running')
    expect(report.completed).toEqual([])
  })

  it('rejects partial, duplicate, reordered, failed, empty, diagnostic and invalid observations', () => {
    const invalid: unknown[] = []
    const partial = observedReport()
    partial.results.pop()
    invalid.push(partial)
    const duplicate = observedReport()
    duplicate.results[1] = duplicate.results[0]!
    invalid.push(duplicate)
    invalid.push({ ...observedReport(), results: observedReport().results.toReversed() })
    invalid.push({ ...observedReport(), results: undefined })
    invalid.push({ ...observedReport(), planned: ['hooks'] })
    invalid.push({ ...observedReport(), suite: 'dependency-internals' })
    invalid.push({ ...observedReport(), status: 'failed' })
    invalid.push({ ...observedReport(), error: { message: 'cleanup failed' } })
    for (const fields of [{ status: 'failed' }, { observations: undefined }, { observations: {} }, { observations: [] }, { durationMs: Number.NaN }, { durationMs: -1 }]) {
      const report = observedReport()
      Object.assign(report.results[0]!, fields)
      invalid.push(report)
    }
    for (const report of invalid) {
      expect(() => completeProductReport(report, viteProductContractNames)).toThrow()
    }
  })

  it('preserves failure evidence and only reports the observed successful prefix', () => {
    const error = new Error('public cleanup failed')
    const report = observedReport()
    Object.assign(report.results[1]!, { status: 'failed' })
    expect(failProductReport(report, error)).toMatchObject({
      status: 'failed',
      completed: ['hooks'],
      failed: 'resolver',
      notExecuted: ['mini-optimizer', 'web-optimizer', 'polling', 'ready'],
      error: { name: 'Error', message: error.message, stack: error.stack },
    })
    expect(failProductReport({ ...report, results: [null] }, error).completed).toEqual([])
    expect(failProductReport({ ...report, results: undefined }, error).error.message).toBe(error.message)
    expect(failProductReport(createProductReport('vite', viteProductContractNames), error)).toMatchObject({
      failed: undefined,
      completed: [],
      notExecuted: viteProductContractNames,
    })
  })

  it('records each completed observation once and preserves it when a later case fails', () => {
    const report = createProductReport('vite', viteProductContractNames)
    const first = { name: 'hooks', status: 'passed', observations: { output: 42 } }
    recordProductResult(report, first)
    expect(report.completed).toEqual(['hooks'])
    expect(report.results).toEqual([first])
    for (const result of [first, { name: 'resolver', status: 'failed', observations: { output: false } }, { name: 'resolver', status: 'passed', observations: {} }]) {
      expect(() => recordProductResult(report, result)).toThrow()
    }
    expect(report.completed).toEqual(['hooks'])
    expect(failProductReport(report, new Error('resolver failed')).completed).toEqual(['hooks'])
  })
})
