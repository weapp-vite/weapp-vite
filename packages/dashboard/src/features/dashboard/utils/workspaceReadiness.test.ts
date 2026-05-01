import type { AnalyzeSubpackagesResult, DashboardRuntimeEvent } from '../types'
import { describe, expect, it } from 'vitest'
import { createWorkspaceReadinessSummary } from './workspaceReadiness'

const baseResult: AnalyzeSubpackagesResult = {
  packages: [
    {
      id: 'main',
      label: '主包',
      type: 'main',
      files: [
        {
          file: 'app.js',
          type: 'chunk',
          from: 'main',
          size: 2048,
        },
      ],
    },
  ],
  modules: [
    {
      id: 'src/app.ts',
      source: 'src/app.ts',
      sourceType: 'src',
      packages: [{ packageId: 'main', files: ['app.js'] }],
    },
  ],
  subPackages: [],
}

function createEvent(event: Partial<DashboardRuntimeEvent> & Pick<DashboardRuntimeEvent, 'id' | 'level' | 'title'>): DashboardRuntimeEvent {
  return {
    kind: 'system',
    detail: 'detail',
    timestamp: '18:00:00',
    source: 'dashboard',
    ...event,
  }
}

describe('createWorkspaceReadinessSummary', () => {
  it('returns pending summary without analyze result', () => {
    const summary = createWorkspaceReadinessSummary({
      result: null,
      runtimeEvents: [],
      diagnostics: [],
      updateCount: 0,
      lastUpdatedAt: '—',
    })

    expect(summary).toMatchObject({
      status: 'pending',
      statusLabel: '等待分析数据',
    })
    expect(summary.actions[0]).toMatchObject({
      id: 'run-analyze',
      to: '/',
    })
    expect(summary.report).toContain('先运行分析命令')
  })

  it('asks for attention when warning events exist', () => {
    const summary = createWorkspaceReadinessSummary({
      result: baseResult,
      runtimeEvents: [
        createEvent({
          id: 'warning',
          level: 'warning',
          title: 'payload warning',
        }),
      ],
      diagnostics: [{ label: '诊断', detail: 'detail', status: 'warning' }],
      updateCount: 2,
      lastUpdatedAt: '18:00:00',
    })

    expect(summary.status).toBe('attention')
    expect(summary.statusDetail).toContain('0 个错误和 1 个警告')
    expect(summary.actions[0]).toMatchObject({
      id: 'open-activity',
      to: '/activity',
    })
    expect(summary.latestEvent).toMatchObject({
      levelLabel: '警告',
      title: 'payload warning',
    })
  })

  it('returns ready summary for loaded payload without event issues', () => {
    const summary = createWorkspaceReadinessSummary({
      result: baseResult,
      runtimeEvents: [
        createEvent({
          id: 'ok',
          level: 'success',
          title: 'analyze completed',
        }),
      ],
      diagnostics: [],
      updateCount: 1,
      lastUpdatedAt: '18:00:00',
    })

    expect(summary).toMatchObject({
      status: 'ready',
      statusLabel: '可以继续分析',
    })
    expect(summary.metrics).toContainEqual({ label: '产物体积', value: '2.00 KB' })
    expect(summary.actions.map(action => action.to)).toEqual(['/analyze', '/analyze?tab=source'])
  })
})
