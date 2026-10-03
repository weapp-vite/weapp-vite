import type { AnalyzeSubpackagesResult, PackageReport, PackageType } from '../../analyze/subpackages/types'
import { describe, expect, it } from 'vitest'
import { createAnalyzeBudgetCheck, createDuplicateModuleInsights } from './index'

function createPackage(id: string, type: PackageType, size: number): PackageReport {
  return { id, label: id, type, files: [{ file: `${id}.js`, type: 'chunk', from: 'main', size }] }
}

describe('shared analyze budgets', () => {
  it('includes exact warning and exceeded boundaries and excludes virtual package limits', () => {
    const result: Pick<AnalyzeSubpackagesResult, 'packages' | 'metadata'> = {
      packages: [
        createPackage('below', 'subPackage', 84),
        createPackage('warning', 'independent', 85),
        createPackage('limit', 'main', 100),
        createPackage('virtual', 'virtual', 31),
      ],
      metadata: {
        generatedAt: '2026-01-01T00:00:00.000Z',
        budgets: { totalBytes: 300, mainBytes: 100, subPackageBytes: 100, independentBytes: 100, warningRatio: 0.85, source: 'config' },
        history: { enabled: false, dir: '', limit: 0 },
      },
    }

    expect(createAnalyzeBudgetCheck(result)).toEqual([
      { id: '__total__', label: '总包', scope: 'total', currentBytes: 300, limitBytes: 300, ratio: 1, status: 'exceeded' },
      { id: 'limit', label: 'limit', scope: 'main', currentBytes: 100, limitBytes: 100, ratio: 1, status: 'exceeded' },
      { id: 'warning', label: 'warning', scope: 'independent', currentBytes: 85, limitBytes: 100, ratio: 0.85, status: 'warning' },
      { id: 'below', label: 'below', scope: 'subPackage', currentBytes: 84, limitBytes: 100, ratio: 0.84, status: 'ok' },
    ].sort((a, b) => b.ratio - a.ratio || a.label.localeCompare(b.label)))
  })

  it('retains Dashboard warning behavior for reports without metadata', () => {
    const packages = [createPackage('main', 'main', 2 * 1024 * 1024)]

    expect(createAnalyzeBudgetCheck({ packages })).toEqual([
      expect.objectContaining({ id: 'main', limitBytes: 2 * 1024 * 1024, ratio: 1, status: 'exceeded' }),
      expect.objectContaining({ id: '__total__', limitBytes: 20 * 1024 * 1024, ratio: 0.1, status: 'ok' }),
    ])
  })
})

describe('shared duplicate module insights', () => {
  it('uses maximum known occurrence and marks independent isolation without promising removable bytes', () => {
    const main = createPackage('main', 'main', 300)
    const feature = createPackage('feature', 'subPackage', 300)
    const independent = createPackage('isolated', 'independent', 300)
    main.files[0]!.modules = [
      { id: 'shared', source: 'shared.ts', sourceType: 'src', bytes: 100, originalBytes: 500 },
      { id: 'ordinary', source: 'ordinary.ts', sourceType: 'src', bytes: 50 },
      { id: 'local', source: 'local.ts', sourceType: 'src', bytes: 200 },
    ]
    feature.files[0]!.modules = [
      { id: 'ordinary', source: 'ordinary.ts', sourceType: 'src', bytes: 80 },
      { id: 'local', source: 'local.ts', sourceType: 'src', bytes: 200 },
    ]
    independent.files[0]!.modules = [
      { id: 'shared', source: 'shared.ts', sourceType: 'src', originalBytes: 150 },
    ]
    const result: Pick<AnalyzeSubpackagesResult, 'packages' | 'modules'> = {
      packages: [main, feature, independent],
      modules: [
        { id: 'shared', source: 'shared.ts', sourceType: 'src', packages: [{ packageId: 'main', files: ['main.js'] }, { packageId: 'isolated', files: ['isolated.js'] }] },
        { id: 'ordinary', source: 'ordinary.ts', sourceType: 'src', packages: [{ packageId: 'main', files: ['main.js'] }, { packageId: 'feature', files: ['feature.js'] }] },
        { id: 'local', source: 'local.ts', sourceType: 'src', packages: [{ packageId: 'main', files: ['main.js', 'other.js'] }] },
      ],
    }

    expect(createDuplicateModuleInsights(result)).toEqual([
      expect.objectContaining({ id: 'shared', bytes: 150, estimatedSavingBytes: 150, packageCount: 2, packages: ['main', 'isolated'], hasIndependentPackage: true }),
      expect.objectContaining({ id: 'ordinary', bytes: 80, estimatedSavingBytes: 80, packageCount: 2, hasIndependentPackage: false }),
    ])
  })
})
