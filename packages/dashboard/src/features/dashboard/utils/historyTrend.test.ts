import { describe, expect, it } from 'vitest'
import { createHistoryTrendSummary } from './historyTrend'

function createSnapshot(id: string, totalBytes: number, capturedAt: string) {
  return {
    id,
    capturedAt,
    label: id,
    result: {
      packages: [],
      modules: [],
      subPackages: [],
    },
    totalBytes,
    compressedBytes: Math.round(totalBytes * 0.4),
    packageCount: 1,
    moduleCount: 1,
    duplicateCount: 0,
  }
}

describe('createHistoryTrendSummary', () => {
  it('detects growing history trend', () => {
    const summary = createHistoryTrendSummary([
      createSnapshot('new', 1600, '2026-05-01T02:00:00.000Z'),
      createSnapshot('old', 1000, '2026-05-01T00:00:00.000Z'),
      createSnapshot('mid', 1300, '2026-05-01T01:00:00.000Z'),
    ])

    expect(summary).toMatchObject({
      status: 'growing',
      totalDeltaBytes: 600,
      averageDeltaBytes: 300,
      projectedNextBytes: 1900,
    })
  })

  it('detects shrinking history trend', () => {
    const summary = createHistoryTrendSummary([
      createSnapshot('old', 1800, '2026-05-01T00:00:00.000Z'),
      createSnapshot('new', 1200, '2026-05-01T01:00:00.000Z'),
    ])

    expect(summary.status).toBe('shrinking')
    expect(summary.metrics.find(item => item.label === '累计变化')?.value).toBe('-600 B')
  })

  it('handles insufficient snapshots', () => {
    const summary = createHistoryTrendSummary([
      createSnapshot('only', 1200, '2026-05-01T00:00:00.000Z'),
    ])

    expect(summary).toMatchObject({
      status: 'insufficient',
    })
    expect(summary.projectedNextBytes).toBeUndefined()
  })
})
