import { describe, expect, it } from 'vitest'
import { createActionWorkQueueItem, createWorkQueueMarkdown, normalizeWorkQueueItems } from './workQueue'

describe('workQueue', () => {
  it('normalizes persisted queue items and removes invalid entries', () => {
    expect(normalizeWorkQueueItems([
      null,
      {
        id: 'action:a',
        targetKind: 'action',
        targetKey: 'a',
        title: '处理预算',
        meta: '主包超预算',
        value: '120%',
        tone: 'critical',
        tab: 'files',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'broken',
        title: 'invalid',
      },
    ])).toEqual([
      {
        id: 'action:a',
        targetKind: 'action',
        targetKey: 'a',
        title: '处理预算',
        meta: '主包超预算',
        value: '120%',
        tone: 'critical',
        tab: 'files',
        createdAt: '2026-01-02T00:00:00.000Z',
        completedAt: undefined,
      },
    ])
  })

  it('creates queue items from action center entries', () => {
    expect(createActionWorkQueueItem({
      key: 'budget:main',
      kind: 'budget',
      title: '处理主包预算',
      meta: '已超预算',
      value: '108%',
      tone: 'critical',
      tab: 'files',
      priority: 100,
    }, '2026-01-02T00:00:00.000Z')).toEqual({
      id: 'action:budget:main',
      targetKind: 'action',
      targetKey: 'budget:main',
      title: '处理主包预算',
      meta: '已超预算',
      value: '108%',
      tone: 'critical',
      tab: 'files',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('exports a markdown checklist summary', () => {
    expect(createWorkQueueMarkdown([
      {
        id: 'action:a',
        targetKind: 'action',
        targetKey: 'a',
        title: '减少重复模块',
        meta: '可合并依赖',
        value: '2 KB',
        tone: 'warning',
        tab: 'modules',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ])).toContain('| 待处理 | 减少重复模块 | 可合并依赖 | 2 KB | modules |')
  })
})
