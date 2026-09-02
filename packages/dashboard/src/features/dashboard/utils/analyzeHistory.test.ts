import type { AnalyzeSubpackagesResult } from '../types'
import { describe, expect, it } from 'vitest'
import { createAnalyzeHistorySnapshot, isSameAnalyzeProject, normalizeHistorySnapshots, resolveInitialPreviousResult } from './analyzeHistory'

function createResult(projectName?: string): AnalyzeSubpackagesResult {
  return {
    metadata: {
      projectName,
      generatedAt: '2026-09-02T00:00:00.000Z',
      budgets: {
        totalBytes: 20 * 1024 * 1024,
        mainBytes: 2 * 1024 * 1024,
        subPackageBytes: 2 * 1024 * 1024,
        independentBytes: 2 * 1024 * 1024,
        warningRatio: 0.85,
        source: 'default',
      },
      history: {
        enabled: true,
        dir: '.weapp-vite/analyze-history',
        limit: 20,
      },
    },
    packages: [],
    modules: [],
    subPackages: [],
  }
}

describe('analyze project history', () => {
  it('does not compare browser history from another project', () => {
    const current = createResult('@varo/realworld-weapp')
    const stored = createResult('@other/project')

    expect(isSameAnalyzeProject(current, stored)).toBe(false)
    expect(resolveInitialPreviousResult(current, null, {
      current: stored,
      previous: null,
    })).toBeNull()
  })

  it('fails closed for nameless legacy history and foreign transport history', () => {
    const current = createResult('@varo/realworld-weapp')
    const legacy = createResult()
    const foreign = createResult('@other/project')

    expect(isSameAnalyzeProject(legacy, createResult())).toBe(false)
    expect(resolveInitialPreviousResult(current, foreign, null)).toBeNull()
  })

  it('filters foreign snapshots and previous results during normalization', () => {
    const current = createResult('@varo/realworld-weapp')
    const foreign = createResult('@other/project')
    const snapshots = normalizeHistorySnapshots({
      current,
      previous: foreign,
      snapshots: [
        createAnalyzeHistorySnapshot(foreign, '2026-09-01T00:00:00.000Z'),
        createAnalyzeHistorySnapshot(current, '2026-09-02T00:00:00.000Z'),
      ],
    })

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.result.metadata?.projectName).toBe('@varo/realworld-weapp')
  })

  it('keeps same-project browser history eligible for comparison', () => {
    const current = createResult('@varo/realworld-weapp')
    const stored = createResult('@varo/realworld-weapp')
    stored.packages = [{ id: '__main__', label: '旧主包', type: 'main', files: [] }]

    expect(isSameAnalyzeProject(current, stored)).toBe(true)
    expect(resolveInitialPreviousResult(current, null, {
      current: stored,
      previous: null,
    })).toBe(stored)
  })
})
