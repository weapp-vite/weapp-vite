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
      primaryRisk: '预算超限 113.0%',
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

    expect(summary.weakestPackage?.id).toBe('growth')
    expect(summary.healthiestPackage?.id).toBe('safe')
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
