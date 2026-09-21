import type { AnalyzeSubpackagesResult } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { createAnalyzeHistorySnapshot } from '../utils/analyzeHistory'
import { dashboardAnalyzeSnapshot } from '../utils/dashboardDevframe'
import { createDashboardWorkspace } from './useDashboardWorkspace'

function createResult(projectName: string, size: number): AnalyzeSubpackagesResult {
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
    packages: [{
      id: '__main__',
      label: '主包',
      type: 'main',
      files: [{ file: 'app.js', type: 'chunk', from: 'main', size }],
    }],
    modules: [],
    subPackages: [],
  }
}

describe('dashboard workspace project identity', () => {
  afterEach(() => {
    dashboardAnalyzeSnapshot.value = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('clears comparison and baseline state when the transport switches projects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const projectA = createResult('@project/a', 100)
    const projectB = createResult('@project/b', 200)
    dashboardAnalyzeSnapshot.value = { current: projectA, previous: null }
    const scope = effectScope()
    const workspace = scope.run(() => createDashboardWorkspace())!
    workspace.setBaselineSnapshot(workspace.historySnapshots.value[0]!.id)
    dashboardAnalyzeSnapshot.value = { current: projectB, previous: null }
    await nextTick()

    expect(workspace.resultRef.value).toBe(projectB)
    expect(workspace.previousResultRef.value).toBeNull()
    expect(workspace.historySnapshots.value).toHaveLength(1)
    expect(workspace.historySnapshots.value[0]?.result.metadata?.projectName).toBe('@project/b')
    expect(workspace.baselineSnapshotId.value).toBeNull()
    expect(workspace.comparisonMode.value).toBe('previous')
    scope.stop()
  })

  it('clears a stored foreign baseline when the first live payload arrives', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const projectA = createResult('@project/a', 100)
    const projectB = createResult('@project/b', 200)
    const projectASnapshot = createAnalyzeHistorySnapshot(projectA, '2026-09-01T00:00:00.000Z')
    const storage = new Map<string, string>([[
      'weapp-vite-dashboard:analyze-result-history',
      JSON.stringify({
        current: projectA,
        previous: projectA,
        snapshots: [projectASnapshot],
        baselineSnapshotId: projectASnapshot.id,
        comparisonMode: 'baseline',
      }),
    ]])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    })
    dashboardAnalyzeSnapshot.value = null
    const scope = effectScope()
    const workspace = scope.run(() => createDashboardWorkspace())!

    dashboardAnalyzeSnapshot.value = { current: projectB, previous: null }
    await nextTick()

    expect(workspace.previousResultRef.value).toBeNull()
    expect(workspace.historySnapshots.value).toHaveLength(1)
    expect(workspace.historySnapshots.value[0]?.result.metadata?.projectName).toBe('@project/b')
    expect(workspace.baselineSnapshotId.value).toBeNull()
    expect(workspace.comparisonMode.value).toBe('previous')
    scope.stop()
  })
})
