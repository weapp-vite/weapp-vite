/* eslint-disable ts/no-use-before-define */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectPerformanceReports,
  COMMENT_MARKER,
  renderPerformanceComment,
  reportStatus,
} from '../.github/scripts/performance-comment-report.mjs'
import { limitBody, upsertComment } from '../.github/scripts/upsert-performance-comment.mjs'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('performance comment report', () => {
  it('normalizes template, auto-import, and runtime-size artifacts', async () => {
    const root = await createFixture()
    const data = await collectPerformanceReports({
      performanceRoot: root.performance,
      runtimeRoot: root.runtime,
      runtimeExpected: { repository: 'owner/repo', prNumber: 42, headSha: 'a'.repeat(40) },
    })
    const normalized = data as any

    expect(normalized.platforms).toHaveLength(1)
    expect(normalized.platforms[0].platform).toBe('ubuntu-latest')
    expect(normalized.autoImport.build.results[0].delta.extraMs).toBe(20)
    expect(normalized.runtimeSize.current.targets).toHaveLength(2)
    expect(normalized.runtimeSize.current.targets[0].tiers[0].production.retainedModules.entry).toBe(
      'wevu-runtime-size-weapp-reactivity-core-production.mjs',
    )
    expect(normalized.runtimeSize.baseline.targets[0].tiers[0].production.retainedModules).toBeUndefined()

    const body = renderPerformanceComment({
      data: normalized,
      metadata: { prNumber: 42, headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40), os: 'ubuntu-latest', node: 'v24', pnpm: '11' },
      runs: [{ name: 'CI Performance', url: 'https://example.test/run', durationMs: 1234 }],
      artifacts: [{ name: 'templates-performance-report-ubuntu-latest', url: 'https://example.test/artifact' }],
    })
    expect(body).toContain(COMMENT_MARKER)
    expect(body).toContain('首次构建')
    expect(body).toContain('HMR update')
    expect(body).toContain('运行时体积')
    expect(body).toContain('20.0 ms')
    expect(body).toContain('artifact: templates-performance-report-ubuntu-latest')
  })

  it('keeps actual raw/wall/RSS values, exposes missing warm/core and does not pass a single sample', async () => {
    const root = await createFixture()
    const data = await collectPerformanceReports({ performanceRoot: root.performance, runtimeRoot: root.runtime, runtimeExpected: { repository: 'owner/repo', prNumber: 42, headSha: 'a'.repeat(40) } })
    const body = renderPerformanceComment({ data, metadata: { prNumber: 42, headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40) } })
    expect(body).toContain('120.0 ms (+20.0 ms, +20.0%) | 不可用 | 110.0 ms')
    expect(body).toContain('60.0 ms (+10.0 ms, +20.0%)')
    expect(body).toContain('60.0 MiB (+10.0 MiB, +20.0%)')
    expect(body).toContain('性能结论：未完成验收')
    expect(body).toContain('自动导入启用成本')
    expect(body).toContain('不是 main 与 PR')
    expect(body).toContain('output-observation')
    expect(body).toContain('a'.repeat(40))
    expect(body).not.toContain('(+20.0 ms, -20.0%)')
    const regressions = body.split('### 关键回归')[1]!
    expect(regressions).toContain('20 组件 / HMR')
    expect(regressions).toContain('+10.0 MiB')
    expect(regressions).not.toContain('10485760.0 ms')
  })

  it('reports partial data and rejects mismatched runtime metadata', async () => {
    const root = await createFixture()
    await writeFile(path.join(root.runtime, 'report.json'), JSON.stringify({ ...createRuntimeArtifact(), repository: 'other/repo' }))
    const data = await collectPerformanceReports({
      performanceRoot: path.join(root.performance, 'missing'),
      runtimeRoot: root.runtime,
      runtimeExpected: { repository: 'owner/repo', prNumber: 42, headSha: 'a'.repeat(40) },
    })
    expect(reportStatus(data)).toBe('failed')
    expect(data.errors.join('\n')).toContain('repository does not match')
  })

  it('caps oversized comments', () => {
    const body = limitBody('x'.repeat(70_000))
    expect(body.length).toBeLessThan(60_000)
    expect(body).toContain('完整明细')
  })
})

describe('performance comment upsert', () => {
  it('creates and updates the marker comment through the GitHub API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    await upsertComment({ apiUrl: 'https://api.example.test', token: 'token', repository: 'owner/repo', prNumber: 42, body: `${COMMENT_MARKER}\nreport` })
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.example.test/repos/owner/repo/issues/42/comments',
      expect.objectContaining({ method: 'POST' }),
    )

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 7, user: { type: 'Bot' }, body: COMMENT_MARKER }]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await upsertComment({ apiUrl: 'https://api.example.test', token: 'token', repository: 'owner/repo', prNumber: 42, body: `${COMMENT_MARKER}\nupdated` })
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.example.test/repos/owner/repo/issues/comments/7',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-performance-comment-'))
  const performance = path.join(root, 'templates-performance-report-ubuntu-latest')
  const runtime = path.join(root, 'runtime')
  await mkdir(performance, { recursive: true })
  await mkdir(runtime, { recursive: true })
  await writeFile(path.join(performance, 'report.json'), JSON.stringify(createTemplatesReport()))
  await writeFile(path.join(performance, 'auto-import', 'report.json'), JSON.stringify(createAutoImportReport())).catch(async () => {
    await mkdir(path.join(performance, 'auto-import'), { recursive: true })
    await writeFile(path.join(performance, 'auto-import', 'report.json'), JSON.stringify(createAutoImportReport()))
  })
  await writeFile(path.join(runtime, 'report.json'), JSON.stringify(createRuntimeArtifact()))
  return { performance, runtime }
}

function createTemplatesReport() {
  const side = (totalMs: number) => ({
    commit: 'a'.repeat(40),
    build: { samples: [{ iteration: 1, status: 0, totalMs }], raw: { totalAverageMs: totalMs, count: 1 }, warm: { totalAverageMs: null, count: 0 } },
    hmr: { templates: [{ scenarios: [{ samples: [{ timingSource: 'output-observation' }] }] }] },
  })
  return {
    baseline: side(100),
    optimized: side(120),
    buildIterations: 1,
    hmrIterations: 1,
    build: {
      all: { cliAverageBaselineMs: 90, cliAverageOptimizedMs: 110, rssPeakAverageBaselineBytes: 90 * 1024 * 1024, rssPeakAverageOptimizedBytes: 100 * 1024 * 1024 },
      rows: [{ id: 'native', comparable: true, baseline: { totalMedianMs: 100, count: 1 }, optimized: { totalMedianMs: 120, count: 1 } }],
    },
    hmr: {
      all: { coreAverageBaselineMs: null, coreAverageOptimizedMs: null, wallAverageBaselineMs: 50, wallAverageOptimizedMs: 60, rssAverageBaselineBytes: 50 * 1024 * 1024, rssAverageOptimizedBytes: 60 * 1024 * 1024 },
      rows: [{ key: 'native:template', comparable: true, baseline: { averageWallMs: 50, wallSamples: [50], rssAverageBytes: 50 * 1024 * 1024 }, optimized: { averageWallMs: 60, wallSamples: [60], rssAverageBytes: 60 * 1024 * 1024 } }],
    },
  }
}

function createAutoImportReport() {
  return {
    build: { results: [{ usedCount: 20, baseline: { mean: 100 }, current: { mean: 120 }, delta: { extraMs: 20, extraPercent: 20 }, baselineMemory: { mean: 10 }, currentMemory: { mean: 12 } }] },
    hmr: { results: [{ usedCount: 20, update: { baseline: { mean: 10 }, current: { mean: 12 }, delta: { extraMs: 2, extraPercent: 20 }, baselineMemory: { heapUsed: { mean: 10 }, rss: { mean: 20 } }, currentMemory: { heapUsed: { mean: 11 }, rss: { mean: 22 } } } }] },
  }
}

function createRuntimeArtifact() {
  const report = (commit: string, offset: number, includeRetainedModules = true) => ({
    version: 3,
    commit,
    targets: ['weapp', 'web'].map(id => ({
      id,
      label: id,
      tiers: ['reactivity-core', 'minimal-app', 'typical-page', 'complex-component', 'full-provider'].map(tierId => ({
        id: tierId,
        dev: { bytes: 1000 + offset },
        production: {
          bytes: 800 + offset,
          ...(id === 'web' ? { gzipBytes: 400 + offset } : {}),
          ...(includeRetainedModules
            ? {
                retainedModules: {
                  entry: `wevu-runtime-size-${id}-${tierId}-production.mjs`,
                  modules: [],
                },
              }
            : {}),
        },
      })),
    })),
  })
  return { version: 3, kind: 'wevu-runtime-size-pr-report', repository: 'owner/repo', prNumber: 42, headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40), current: report('a'.repeat(12), 100), baseline: report('b'.repeat(12), 0, false) }
}
