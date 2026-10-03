import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import { initDevframe } from 'devframe/initiate'
import { describe, expect, it } from 'vitest'
import { createArtifactAnalysis } from '../../analyze/subpackages/artifacts'
import { createAnalyzeDashboardDevframe } from '../index'

function report(): AnalyzeSubpackagesResult {
  return {
    packages: [
      { id: 'main', label: 'main', type: 'main', files: [
        { file: 'a.js', type: 'chunk', from: 'main', size: 100, modules: [{ id: 'a', source: 'src/a.ts', sourceType: 'src', bytes: 50 }] },
        { file: 'b.js', type: 'chunk', from: 'main', size: 100, modules: [{ id: 'b', source: 'src/b.ts', sourceType: 'src', bytes: 20 }] },
      ] },
      { id: 'feature', label: 'feature', type: 'subPackage', files: [
        { file: 'feature/a.js', type: 'chunk', from: 'main', size: 80, modules: [{ id: 'a', source: 'src/a.ts', sourceType: 'src', bytes: 40 }] },
        { file: 'feature/unknown.js', type: 'asset', from: 'main' },
      ] },
    ],
    modules: [
      { id: 'a', source: 'src/a.ts', sourceType: 'src', packages: [{ packageId: 'main', files: ['a.js'] }, { packageId: 'feature', files: ['feature/a.js'] }] },
      { id: 'b', source: 'src/b.ts', sourceType: 'src', packages: [{ packageId: 'main', files: ['b.js'] }] },
    ],
    subPackages: [],
    metadata: {
      generatedAt: '2026-01-01T00:00:00Z',
      budgets: { totalBytes: 500, mainBytes: 200, subPackageBytes: 100, independentBytes: 100, warningRatio: 0.8, source: 'config' },
      history: { enabled: false, dir: '', limit: 0 },
    },
    glassEasel: { detected: false, minimumBaseLibrary: '', migrationGuide: '', diagnostics: [], summary: { errors: 0, warnings: 0 } },
  }
}

describe('Dashboard domain queries', () => {
  it('pins bounded catalog pages to one snapshot and intersects placement filters', async () => {
    const controller = createAnalyzeDashboardDevframe({ snapshot: { current: report(), previous: null, artifacts: new Map() }, roots: {} })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    try {
      await instance.ready
      const rpc = (await instance.context).scope('weapp-vite').rpc
      const state = await rpc.call('get-dashboard-state')
      expect(await rpc.call('get-analyze-summary', { revision: 0 })).toMatchObject({
        reportHash: state.analyze.current.hash,
        totals: { bytes: 280, files: 4, unmeasuredFiles: 1 },
        totalBudget: { status: 'unknown' },
        runtimeBudget: null,
        packageBudgets: { exceeded: 1, warning: 0, ok: 0, unknown: 1 },
      })
      const first = await rpc.call('query-analyze-artifacts', { revision: 0, limit: 1 })
      const second = await rpc.call('query-analyze-artifacts', { revision: 0, limit: 1, offset: first.nextOffset! })
      expect(first.items.map(item => item.file)).toEqual(['a.js'])
      expect(second.items.map(item => item.file)).toEqual(['b.js'])
      expect(second.reportHash).toBe(first.reportHash)
      expect(await rpc.call('query-analyze-artifacts', { revision: 0, query: 'unknown' })).toMatchObject({ items: [{ size: null }] })
      expect(await rpc.call('query-analyze-packages', { revision: 0, budgetStatus: 'exceeded' })).toMatchObject({
        total: 1,
        items: [{ id: 'main', moduleCount: 2, budget: { ratio: 1, status: 'exceeded' } }],
      })
      expect(await rpc.call('query-analyze-packages', { revision: 0, budgetStatus: 'unknown' })).toMatchObject({
        total: 1,
        items: [{ id: 'feature', budget: { status: 'unknown', measurement: 'file-bytes' } }],
      })
      expect(await rpc.call('query-analyze-modules', { revision: 0, packageId: 'main', artifact: 'feature/a.js' })).toMatchObject({ total: 0, items: [] })
      expect(await rpc.call('query-analyze-modules', { revision: 0, packageId: 'feature', artifact: 'feature/a.js', query: 'SRC/A' })).toMatchObject({
        total: 1,
        items: [{ id: 'a', packageCount: 2, fileCount: 2, bytes: 50 }],
      })
      expect(await rpc.call('compare-analyze-builds', { revision: 0, scope: 'file' })).toMatchObject({ available: false, previousHash: null, totals: null, items: [] })
      await expect(rpc.call('get-analyze-summary', { revision: 0, target: 'previous' })).rejects.toThrow('上一份')
      await controller.update(report(), new Map())
      await expect(rpc.call('query-analyze-artifacts', { revision: 0, offset: second.nextOffset! })).rejects.toThrow('Analyze revision')
      expect(await rpc.call('query-analyze-artifacts', { revision: 1, target: 'previous', offset: 2 })).toMatchObject({
        reportHash: first.reportHash,
        items: [{ file: 'feature/a.js' }, { file: 'feature/unknown.js' }],
        nextOffset: null,
      })
      expect(await rpc.call('query-analyze-artifacts', { revision: 1, offset: 10 })).toMatchObject({ total: 4, items: [], nextOffset: null })
      controller.dispose()
      await expect(rpc.call('get-analyze-summary', { revision: 1 })).rejects.toThrow('Analyze revision')
      await expect(rpc.call('query-runtime-events', {})).rejects.toThrow('会话已关闭')
    }
    finally {
      controller.dispose()
      await instance.close()
    }
  })

  it('compares module occurrences inside the selected package, not their global representative', async () => {
    const previous = report()
    const current = report()
    current.packages[1]!.files[0]!.modules![0]!.bytes = 60
    current.packages[1]!.files[0]!.size = 100
    const controller = createAnalyzeDashboardDevframe({ snapshot: { current, previous, artifacts: new Map() }, roots: {} })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    try {
      await instance.ready
      const rpc = (await instance.context).scope('weapp-vite').rpc
      expect(await rpc.call('compare-analyze-builds', { revision: 0, scope: 'module', packageId: 'feature' })).toMatchObject({
        totals: { currentBytes: null, previousBytes: null, deltaBytes: null, currentUnmeasuredFiles: 1, previousUnmeasuredFiles: 1 },
        items: [{ packageId: 'feature', moduleId: 'a', previousBytes: 40, currentBytes: 60, deltaBytes: 20 }],
      })
      expect(await rpc.call('compare-analyze-builds', { revision: 0, scope: 'module', packageId: 'main' })).toMatchObject({
        total: 0,
        items: [],
        totals: { deltaBytes: null, currentUnmeasuredFiles: 1, previousUnmeasuredFiles: 1 },
      })
      const first = await rpc.call('compare-analyze-builds', { revision: 0, scope: 'file', limit: 1 })
      expect(first).toMatchObject({ total: 2, nextOffset: 1, items: [{ change: 'increased', deltaBytes: 20 }] })
      expect(await rpc.call('compare-analyze-builds', { revision: 0, scope: 'file', offset: first.nextOffset!, limit: 1 })).toMatchObject({
        nextOffset: null,
        items: [{ file: 'feature/unknown.js', change: 'unmeasured', currentBytes: null, previousBytes: null, deltaBytes: null }],
      })
      expect(await rpc.call('compare-analyze-builds', { revision: 0, scope: 'file', change: 'unmeasured' })).toMatchObject({
        total: 1,
        items: [{ file: 'feature/unknown.js', change: 'unmeasured' }],
      })
    }
    finally {
      controller.dispose()
      await instance.close()
    }
  })

  it('includes asset source placements that are absent from chunk module contributions', async () => {
    const current = report()
    current.modules.push({
      id: 'style',
      source: 'src/styles.css',
      sourceType: 'src',
      packages: [{ packageId: 'feature', files: ['feature/unknown.js'] }],
    })
    const controller = createAnalyzeDashboardDevframe({ snapshot: { current, previous: null, artifacts: new Map() }, roots: {} })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    try {
      await instance.ready
      const rpc = (await instance.context).scope('weapp-vite').rpc
      expect(await rpc.call('query-analyze-packages', { revision: 0, query: 'feature' })).toMatchObject({
        items: [{ id: 'feature', moduleCount: 2 }],
      })
      expect(await rpc.call('query-analyze-artifacts', { revision: 0, moduleId: 'style' })).toMatchObject({
        total: 1,
        items: [{ packageId: 'feature', file: 'feature/unknown.js', moduleCount: 1 }],
      })
    }
    finally {
      controller.dispose()
      await instance.close()
    }
  })

  it('retains runtime budget completeness and package overrides without unbounded file lists', async () => {
    const current = report()
    current.metadata!.budgets.runtimeBytes = 10
    current.metadata!.budgets.packageBytes = { main: 50 }
    const controller = createAnalyzeDashboardDevframe({ snapshot: { current, previous: null, artifacts: new Map() }, roots: {} })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    try {
      await instance.ready
      const rpc = (await instance.context).scope('weapp-vite').rpc
      const summary = await rpc.call('get-analyze-summary', { revision: 0 })
      expect(summary).toMatchObject({
        runtimeBudget: { status: 'unknown', measurement: 'unavailable' },
        packageBudgets: { exceeded: 1, unknown: 1, ok: 0, warning: 0 },
      })
      expect(summary.totalBudget).not.toHaveProperty('files')
      expect(summary.runtimeBudget).not.toHaveProperty('files')
      expect(await rpc.call('query-analyze-packages', { revision: 0, query: 'main' })).toMatchObject({
        items: [{ budget: { limitBytes: 50, ratio: 4, status: 'exceeded' } }],
      })

      current.packages[1]!.files.pop()
      current.packages[0]!.files[0]!.modules![0]!.sourceType = 'node_modules'
      current.artifacts = createArtifactAnalysis(current.packages, id => id === 'a' ? { name: 'wevu' } : undefined)
      await controller.update(current, new Map())
      expect(await rpc.call('get-analyze-summary', { revision: 1 })).toMatchObject({
        runtimeBudget: { currentBytes: 100, limitBytes: 10, status: 'exceeded', measurement: 'upper-bound' },
        packageBudgets: { exceeded: 1, warning: 1, unknown: 0, ok: 0 },
      })
    }
    finally {
      controller.dispose()
      await instance.close()
    }
  })
})
