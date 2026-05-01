import { describe, expect, it } from 'vitest'
import { createModuleOptimizationPlanSummary } from './moduleOptimizationPlan'

describe('createModuleOptimizationPlanSummary', () => {
  it('prioritizes duplicate module savings', () => {
    const summary = createModuleOptimizationPlanSummary({
      duplicateModules: [
        {
          id: 'shared:metrics',
          source: 'shared/metrics.ts',
          sourceType: 'src',
          packageCount: 2,
          bytes: 420,
          estimatedSavingBytes: 840,
          advice: '抽到共享入口。',
          packages: [
            { packageId: 'main', packageLabel: '主包', files: ['app.js'] },
            { packageId: 'pkg-a', packageLabel: '分包 A', files: ['pkg-a/index.js'] },
          ],
        },
      ],
      incrementAttribution: [],
      largestFiles: [],
    })

    expect(summary.items[0]).toMatchObject({
      id: 'duplicate:shared:metrics',
      effort: 'low',
      impactBytes: 840,
    })
    expect(summary.quickWinCount).toBe(1)
  })

  it('adds increment and large file fallback items', () => {
    const summary = createModuleOptimizationPlanSummary({
      duplicateModules: [],
      incrementAttribution: [
        {
          key: 'increment:dep',
          label: 'node_modules/lodash-es/index.js',
          category: '第三方依赖',
          packageLabel: '主包',
          currentBytes: 4096,
          previousBytes: 0,
          deltaBytes: 4096,
          advice: '检查依赖边界。',
        },
      ],
      largestFiles: [
        {
          packageId: 'main',
          packageLabel: '主包',
          packageType: 'main',
          file: 'app.js',
          size: 8192,
          compressedSize: 4096,
          compressedSizeSource: 'estimated',
          type: 'chunk',
          from: 'main',
          isEntry: true,
          moduleCount: 14,
        },
      ],
    })

    expect(summary.items.map(item => item.id)).toEqual([
      'file:main:app.js',
      'increment:increment:dep',
    ])
  })

  it('creates a markdown report', () => {
    const summary = createModuleOptimizationPlanSummary({
      duplicateModules: [],
      incrementAttribution: [],
      largestFiles: [],
    })

    expect(summary.report).toContain('# dashboard 模块优化计划')
    expect(summary.report).toContain('| 优先级 | 事项 | 影响 | 成本 | 建议 |')
  })
})
