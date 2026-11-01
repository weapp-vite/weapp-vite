import { describe, expect, it, vi } from 'vitest'
import { completeProductReport, createProductReport, recordProductResult } from '../../report.mjs'
import { createProductContracts, productContractNames } from './index.mjs'

describe('Rolldown public product inventory', () => {
  it('requires every public lifecycle case without starting a native operation during registration', () => {
    const native = vi.fn(() => {
      throw new Error('Registration must not start a native operation')
    })
    const contracts = createProductContracts({ rolldown: native, watch: native, scan: native }, 'fixture')
    expect(productContractNames).toEqual(['generate-write', 'close', 'errors', 'inflight-error', 'repeat-build', 'watch', 'scan'])
    expect(Object.isFrozen(productContractNames)).toBe(true)
    expect(Object.keys(contracts)).toEqual(productContractNames)
    expect(Object.values(contracts).every(contract => typeof contract === 'function')).toBe(true)
    expect(native).not.toHaveBeenCalled()
  })

  it('does not accept a passing Rolldown report until every public case has an observation', () => {
    const report = createProductReport('rolldown', productContractNames)
    for (const name of productContractNames) {
      expect(() => completeProductReport(report, productContractNames)).toThrow()
      recordProductResult(report, { name, status: 'passed', observations: { outputVerified: true } })
    }
    expect(completeProductReport(report, productContractNames)).toMatchObject({
      dependency: 'rolldown',
      suite: 'product-lifecycle',
      status: 'passed',
      planned: productContractNames,
      completed: productContractNames,
    })
    expect(() => recordProductResult(report, report.results[0])).toThrow()
  })
})
