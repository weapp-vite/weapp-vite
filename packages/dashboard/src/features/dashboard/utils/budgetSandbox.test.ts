import type { AnalyzeSubpackagesResult } from '../types'
import type { BudgetSandboxConfig } from './budgetSandbox'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  budgetSandboxPresets,
  createBudgetConfigSnippet,
  createBudgetSandboxWarnings,
  findMatchingBudgetPreset,
  normalizeBudgetSandboxConfig,
} from './budgetSandbox'

function createResult(sizes: Record<string, number | undefined>): AnalyzeSubpackagesResult {
  return {
    packages: Object.entries(sizes).map(([id, size], index) => ({
      id,
      label: id,
      type: index === 0 ? 'main' : 'subPackage',
      files: [{ file: `${id}.js`, type: 'chunk', from: 'main', size }],
    })),
    modules: [],
    subPackages: [],
  }
}

describe('budgetSandbox', () => {
  it('normalizes invalid sandbox config values', () => {
    expect(normalizeBudgetSandboxConfig({
      totalBytes: -1,
      mainBytes: Number.NaN,
      subPackageBytes: 3000,
      independentBytes: 4000,
      warningRatio: 2,
    })).toEqual({
      totalBytes: 20 * 1024 * 1024,
      mainBytes: 2 * 1024 * 1024,
      subPackageBytes: 3000,
      independentBytes: 4000,
      warningRatio: 0.99,
    })
  })

  it('projects total and package warnings from sandbox budgets', () => {
    expect(createBudgetSandboxWarnings({
      result: createResult({ main: 900, subpackage: 600 }),
      config: {
        totalBytes: 1000,
        mainBytes: 1000,
        subPackageBytes: 1000,
        independentBytes: 1000,
        warningRatio: 0.85,
      },
    }).map(item => [item.id, item.status])).toEqual([
      ['__total__', 'critical'],
      ['main', 'warning'],
    ])
  })

  it('preserves zero runtime/package constraints through exported configuration', () => {
    const config = normalizeBudgetSandboxConfig({
      totalBytes: 2000,
      mainBytes: 1000,
      packageBytes: { 'main': 0, 'feature"quoted': 0 },
      runtimeBytes: 0,
    })
    const exported = runInNewContext(`({${createBudgetConfigSnippet(config)}})`, {}, { timeout: 100 }) as { analyze: { budgets: BudgetSandboxConfig } }
    expect(createBudgetSandboxWarnings({
      result: createResult({ 'main': 900, 'feature"quoted': 100 }),
      config: exported.analyze.budgets,
    }).map(item => [item.id, item.limitBytes, item.status]).sort()).toEqual([
      ['__runtime__', 0, 'unknown'],
      ['feature"quoted', 0, 'critical'],
      ['main', 0, 'critical'],
    ])
  })

  it('does not claim that raising limits resolves missing measurements', () => {
    const result = createResult({ main: undefined })
    const config = normalizeBudgetSandboxConfig({ totalBytes: 10000, mainBytes: 5000 })
    expect(createBudgetSandboxWarnings({ result, config }).map(item => [item.id, item.limitBytes, item.status]).sort()).toEqual([
      ['__total__', 10000, 'unknown'],
      ['main', 5000, 'unknown'],
    ])
    result.packages[0]!.files[0]!.size = 900
    expect(createBudgetSandboxWarnings({ result, config })).toEqual([])
  })

  it('matches normalized sandbox presets', () => {
    expect(findMatchingBudgetPreset({
      ...budgetSandboxPresets[1]!.config,
      totalBytes: 20 * 1024 * 1024 + 0.2,
    })?.id).toBe('release-buffer')
  })
})
