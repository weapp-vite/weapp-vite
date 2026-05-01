import { describe, expect, it } from 'vitest'
import { createBudgetConfigSnippet, createBudgetSandboxWarnings, normalizeBudgetSandboxConfig } from './budgetSandbox'

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
      totalBytes: 1200,
      packages: [
        { id: 'main', label: '主包', type: 'main', totalBytes: 900 },
        { id: 'subpackage', label: '分包', type: 'subPackage', totalBytes: 600 },
      ],
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

  it('creates a config snippet for weapp-vite analyze budgets', () => {
    expect(createBudgetConfigSnippet({
      totalBytes: 1000,
      mainBytes: 200,
      subPackageBytes: 300,
      independentBytes: 400,
      warningRatio: 0.8,
    })).toContain('warningRatio: 0.8')
  })
})
