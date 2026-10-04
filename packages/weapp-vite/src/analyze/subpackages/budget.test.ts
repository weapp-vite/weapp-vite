import type { AnalyzeSubpackagesResult } from './types'
import { describe, expect, it } from 'vitest'
import { createArtifactAnalysis } from './artifacts'
import { createAnalyzeBudgetCheck } from './budget'

function result(): AnalyzeSubpackagesResult {
  const value: AnalyzeSubpackagesResult = {
    metadata: {
      generatedAt: '',
      history: { enabled: false, dir: '', limit: 1 },
      budgets: { totalBytes: 1000, mainBytes: 1000, subPackageBytes: 1000, independentBytes: 1000, runtimeBytes: 50, packageBytes: { sub: 30 }, warningRatio: 0.85, source: 'config' },
    },
    packages: [
      { id: '__main__', label: '主包', type: 'main', files: [{ file: 'hashed.js', type: 'chunk', from: 'main', size: 80, modules: [{ id: 'wevu', source: 'wevu', sourceType: 'node_modules', bytes: 80 }] }] },
      { id: 'sub', label: 'sub', type: 'subPackage', files: [{ file: 'sub/index.js', type: 'chunk', from: 'main', size: 40, modules: [{ id: 'app', source: 'app', sourceType: 'src', bytes: 40 }] }] },
    ],
    modules: [],
    subPackages: [],
    glassEasel: { detected: false, diagnostics: [], summary: { errors: 0, warnings: 0 } } as AnalyzeSubpackagesResult['glassEasel'],
  }
  value.artifacts = createArtifactAnalysis(value.packages, id => id === 'wevu' ? { name: 'wevu' } : undefined)
  return value
}

describe('artifact budgets', () => {
  it('reports runtime upper bounds and per-package overrides with contributing files', () => {
    const checks = createAnalyzeBudgetCheck(result())
    expect(checks.find(check => check.scope === 'runtime')).toMatchObject({
      currentBytes: 80,
      limitBytes: 50,
      status: 'exceeded',
      measurement: 'upper-bound',
      files: ['hashed.js'],
    })
    expect(checks.find(check => check.id === 'sub')).toMatchObject({ currentBytes: 40, limitBytes: 30, status: 'exceeded', files: ['sub/index.js'] })
    expect(checks.find(check => check.scope === 'total')?.currentBytes).toBe(120)
  })

  it('fails closed for old reports without attribution when a runtime budget is requested', () => {
    const value = result()
    delete value.artifacts
    expect(createAnalyzeBudgetCheck(value).find(check => check.scope === 'runtime')).toMatchObject({ status: 'unknown', measurement: 'unavailable' })
    delete value.metadata!.budgets.runtimeBytes
    expect(createAnalyzeBudgetCheck(value).some(check => check.status === 'unknown')).toBe(false)
  })
})
