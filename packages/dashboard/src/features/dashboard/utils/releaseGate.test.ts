import { describe, expect, it } from 'vitest'
import { createReleaseGateSummary } from './releaseGate'

describe('createReleaseGateSummary', () => {
  it('blocks release when critical actions exist', () => {
    expect(createReleaseGateSummary({
      actionItems: [
        {
          key: 'budget:main',
          kind: 'budget',
          title: '处理主包预算',
          meta: '已超预算',
          tone: 'critical',
          tab: 'files',
          priority: 100,
        },
      ],
      largestFiles: [],
      packageInsights: [],
    })).toMatchObject({
      status: 'blocked',
      label: 'Blocked',
      score: 72,
    })
  })

  it('marks release for review when only warnings exist', () => {
    expect(createReleaseGateSummary({
      actionItems: [
        {
          key: 'increment:a',
          kind: 'increment',
          title: '定位增长',
          meta: '新增依赖',
          tone: 'warning',
          tab: 'files',
          priority: 90,
        },
      ],
      largestFiles: [],
      packageInsights: [],
    }).status).toBe('review')
  })

  it('creates a copyable markdown report', () => {
    expect(createReleaseGateSummary({
      actionItems: [],
      largestFiles: [],
      packageInsights: [],
    }).report).toContain('# dashboard 发布门禁')
  })
})
