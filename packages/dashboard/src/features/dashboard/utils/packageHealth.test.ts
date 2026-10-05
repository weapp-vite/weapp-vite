import { describe, expect, it } from 'vitest'
import { createPackageHealthSummary } from './packageHealth'

describe('createPackageHealthSummary', () => {
  it('scores packages with budget warnings as riskier', () => {
    const summary = createPackageHealthSummary({
      packageInsights: [
        {
          id: 'main',
          label: '主包',
          type: 'main',
          totalBytes: 1024,
          gzipBytes: 512,
          brotliBytes: 420,
          compressedBytes: 420,
          compressedSizeSource: 'real',
          fileCount: 2,
          chunkCount: 1,
          assetCount: 1,
          moduleCount: 8,
          duplicateModuleCount: 0,
          entryFileCount: 1,
          topFiles: [],
        },
      ],
      budgetWarnings: [
        {
          id: 'main',
          label: '主包',
          scope: 'main',
          currentBytes: 1024,
          limitBytes: 900,
          ratio: 1.13,
          status: 'critical',
        },
      ],
    })

    expect(summary.items[0]).toMatchObject({
      id: 'main',
      status: 'risk',
      score: 68,
      primaryRiskKind: 'budget',
    })
  })

  it('orders the weakest package first', () => {
    const summary = createPackageHealthSummary({
      packageInsights: [
        {
          id: 'safe',
          label: '安全包',
          type: 'subPackage',
          totalBytes: 1000,
          gzipBytes: 500,
          brotliBytes: 400,
          compressedBytes: 400,
          compressedSizeSource: 'real',
          fileCount: 2,
          chunkCount: 1,
          assetCount: 1,
          moduleCount: 10,
          duplicateModuleCount: 0,
          entryFileCount: 1,
          topFiles: [],
        },
        {
          id: 'growth',
          label: '增长包',
          type: 'subPackage',
          totalBytes: 1000,
          gzipBytes: 500,
          brotliBytes: 400,
          compressedBytes: 400,
          compressedSizeSource: 'real',
          sizeDeltaBytes: 300,
          fileCount: 3,
          chunkCount: 2,
          assetCount: 1,
          moduleCount: 10,
          duplicateModuleCount: 4,
          entryFileCount: 3,
          topFiles: [],
        },
      ],
      budgetWarnings: [],
    })

    expect(summary.weakestPackage).toMatchObject({
      id: 'growth',
      score: 58,
      status: 'risk',
      primaryRiskKind: 'growth',
    })
    expect(summary.healthiestPackage).toMatchObject({
      id: 'safe',
      score: 100,
      status: 'good',
      primaryRiskKind: 'none',
    })
  })

  it.each([
    { warningStatus: 'warning', delta: 100, kind: 'budget', score: 62, status: 'risk' },
    { warningStatus: 'unknown', delta: 0, kind: 'duplicates', score: 70, status: 'watch' },
    { warningStatus: undefined, delta: -100, kind: 'duplicates', score: 88, status: 'good' },
  ] as const)('classifies primary risk with $warningStatus budget and $delta growth', ({ warningStatus, delta, kind, score, status }) => {
    const summary = createPackageHealthSummary({
      packageInsights: [
        {
          id: 'packages/shared',
          label: '独立分包 packages/shared',
          type: 'independent',
          totalBytes: 1000,
          gzipBytes: 500,
          brotliBytes: 400,
          compressedBytes: 400,
          compressedSizeSource: 'real',
          sizeDeltaBytes: delta,
          fileCount: 2,
          chunkCount: 1,
          assetCount: 1,
          moduleCount: 10,
          duplicateModuleCount: 2,
          entryFileCount: 1,
          topFiles: [],
        },
      ],
      budgetWarnings: warningStatus
        ? [{
            id: 'packages/shared',
            label: '独立分包 packages/shared',
            scope: 'independent',
            currentBytes: 1000,
            limitBytes: 1100,
            ratio: 1000 / 1100,
            status: warningStatus,
          }]
        : [],
    })

    expect(summary.items[0]).toMatchObject({
      primaryRiskKind: kind,
      score,
      status,
    })
  })

  it('returns a healthy empty summary', () => {
    expect(createPackageHealthSummary({
      packageInsights: [],
      budgetWarnings: [],
    })).toMatchObject({
      averageScore: 100,
      riskCount: 0,
      watchCount: 0,
      items: [],
    })
  })
})
