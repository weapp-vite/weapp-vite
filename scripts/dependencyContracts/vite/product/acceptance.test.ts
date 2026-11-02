import { describe, expect, it } from 'vitest'
import { completeProductReport, createProductReport, failProductReport, recordProductResult } from '../../report.mjs'
import { applyViteAcceptancePolicy, finalizeViteAcceptanceReport } from './acceptance.mjs'
import { viteProductContractNames, viteRequiredContractNames } from './inventory.mjs'

const versions = { vite: '8.3.5', rolldown: '1.2.16' }

type AcceptanceReport = Omit<ReturnType<typeof createProductReport>, 'results'> & {
  results: { name: string }[]
  currentContract?: string
  assessment?: string
  notExecuted?: string[]
}

function report() {
  const value: AcceptanceReport = createProductReport('vite', viteRequiredContractNames)
  applyViteAcceptancePolicy(value, versions)
  return value
}

describe('version-bound Vite acceptance exception', () => {
  it('records only observed required results and explicitly leaves Web unexecuted', () => {
    const value = report()
    for (const name of viteRequiredContractNames) {
      recordProductResult(value, { name, status: 'passed', observations: { observed: true } })
    }
    Object.assign(value, completeProductReport(value, viteRequiredContractNames))
    finalizeViteAcceptanceReport(value)
    expect(value).toMatchObject({
      status: 'passed',
      assessment: 'accepted-with-waivers',
      fullInventory: viteProductContractNames,
      planned: ['hooks', 'resolver', 'mini-optimizer', 'polling', 'ready'],
      completed: ['hooks', 'resolver', 'mini-optimizer', 'polling', 'ready'],
      notExecuted: ['web-optimizer'],
      waived: [{ name: 'web-optimizer', versions, documentation: 'patches/compiler-memory.md' }],
    })
    expect(value.results.some(item => item.name === 'web-optimizer')).toBe(false)
  })

  it.each([
    { vite: '8.3.6', rolldown: '1.2.16' },
    { vite: '8.3.5', rolldown: '1.2.15' },
    { vite: '8.3.5', rolldown: '1.2.17' },
  ])('rejects automatic inheritance by %j', (installed) => {
    const value = createProductReport('vite', viteRequiredContractNames)
    expect(() => applyViteAcceptancePolicy(value, installed)).toThrow(/review or remove/i)
    expect(value).not.toHaveProperty('waived')
    expect(value).not.toHaveProperty('assessment', 'accepted-with-waivers')
  })

  it('retains original failures and both waived and unreached contracts', () => {
    const value = report()
    recordProductResult(value, { name: 'hooks', status: 'passed', observations: { observed: true } })
    value.currentContract = 'resolver'
    const original = new Error('resolver original failure')
    Object.assign(value, failProductReport(value, original))
    finalizeViteAcceptanceReport(value)
    expect(value).toMatchObject({
      status: 'failed',
      assessment: 'incomplete-with-waivers',
      failed: 'resolver',
      completed: ['hooks'],
      notExecuted: ['mini-optimizer', 'web-optimizer', 'polling', 'ready'],
      error: { message: original.message },
    })
  })

  it('cannot waive cleanup errors, timeouts or incomplete observations', () => {
    for (const status of ['failed', 'timeout', 'interrupted', 'running']) {
      const value = report()
      value.status = status
      finalizeViteAcceptanceReport(value)
      expect(value.assessment).toBe('incomplete-with-waivers')
      expect(value.status).toBe(status)
      expect(value.notExecuted).toEqual(viteProductContractNames)
    }
    expect(() => completeProductReport(report(), viteRequiredContractNames)).toThrow()
  })
})
