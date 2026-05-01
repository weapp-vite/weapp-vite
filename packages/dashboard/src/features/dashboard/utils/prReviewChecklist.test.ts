import { describe, expect, it } from 'vitest'
import { createPrReviewChecklistSummary } from './prReviewChecklist'

describe('createPrReviewChecklistSummary', () => {
  it('blocks the PR when critical actions exist', () => {
    const summary = createPrReviewChecklistSummary({
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
      workQueueItems: [],
    })

    expect(summary).toMatchObject({
      status: 'blocked',
      label: 'Blocked',
    })
    expect(summary.lanes[0]?.items).toHaveLength(1)
  })

  it('marks the PR for review when warnings or open queue items exist', () => {
    expect(createPrReviewChecklistSummary({
      actionItems: [
        {
          key: 'increment:a',
          kind: 'increment',
          title: '定位增长',
          meta: '新增依赖',
          tone: 'warning',
          tab: 'modules',
          priority: 90,
        },
      ],
      workQueueItems: [],
    }).status).toBe('review')

    expect(createPrReviewChecklistSummary({
      actionItems: [],
      workQueueItems: [
        {
          id: 'action:increment:a',
          targetKind: 'action',
          targetKey: 'increment:a',
          title: '定位增长',
          meta: '新增依赖',
          tone: 'warning',
          tab: 'modules',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    }).status).toBe('review')
  })

  it('creates a copyable markdown checklist', () => {
    const summary = createPrReviewChecklistSummary({
      actionItems: [],
      workQueueItems: [],
    })

    expect(summary.status).toBe('ready')
    expect(summary.report).toContain('## PR 风险清单')
    expect(summary.report).toContain('- [x] 没有阻断项。')
  })
})
