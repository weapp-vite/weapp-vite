import type { DashboardRuntimeEvent } from '../types'
import { describe, expect, it } from 'vitest'
import { createRuntimeIncidentDigest } from './runtimeIncidentDigest'

function createEvent(event: Partial<DashboardRuntimeEvent> & Pick<DashboardRuntimeEvent, 'id' | 'level' | 'title'>): DashboardRuntimeEvent {
  return {
    kind: 'system',
    detail: 'detail',
    timestamp: '2026-05-01 10:00:00',
    source: 'dashboard',
    ...event,
  }
}

describe('createRuntimeIncidentDigest', () => {
  it('marks error events as critical and orders incidents by severity', () => {
    const digest = createRuntimeIncidentDigest([
      createEvent({
        id: 'slow',
        level: 'info',
        title: 'slow command',
        durationMs: 1800,
        source: 'cli',
      }),
      createEvent({
        id: 'warning',
        level: 'warning',
        title: 'warning diagnostic',
        source: 'diagnostics',
      }),
      createEvent({
        id: 'error',
        level: 'error',
        title: 'failed build',
        source: 'builder',
      }),
    ])

    expect(digest).toMatchObject({
      status: 'critical',
      statusLabel: '需要立即处理',
      affectedSources: ['builder', 'cli', 'diagnostics'],
    })
    expect(digest.metrics).toEqual([
      { label: '事件总数', value: 3 },
      { label: '错误', value: 1 },
      { label: '警告', value: 1 },
      { label: '慢事件', value: 1 },
      { label: '影响来源', value: 3 },
    ])
    expect(digest.incidents.map(item => item.id)).toEqual(['error', 'warning', 'slow'])
    expect(digest.report).toContain('[错误] failed build')
  })

  it('marks slow events without errors as warning', () => {
    const digest = createRuntimeIncidentDigest([
      createEvent({
        id: 'hmr',
        level: 'success',
        title: 'hmr updated',
        kind: 'hmr',
        durationMs: 1200,
      }),
    ])

    expect(digest.status).toBe('warning')
    expect(digest.incidents[0]).toMatchObject({
      id: 'hmr',
      reason: '耗时 1.20 s',
      kindLabel: 'HMR',
    })
  })

  it('returns a healthy digest when no incidents are present', () => {
    const digest = createRuntimeIncidentDigest([
      createEvent({
        id: 'ok',
        level: 'success',
        title: 'build completed',
        durationMs: 240,
      }),
    ])

    expect(digest).toMatchObject({
      status: 'healthy',
      statusLabel: '运行平稳',
      statusDetail: '当前筛选范围内没有错误、警告或慢事件。',
      affectedSources: [],
      incidents: [],
    })
    expect(digest.report).toContain('当前筛选范围内没有需要处理的事件。')
  })
})
