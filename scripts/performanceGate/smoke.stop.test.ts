import type { CollectorStop } from './collectorStop'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { policy, shards, smokeMetrics } from './contract.mjs'
import { verifySmoke } from './smokeReport.mjs'

const mocks = vi.hoisted(() => ({ launch: vi.fn(), side: vi.fn(), manifest: vi.fn() }))
vi.mock('./process', () => ({ runCollector: mocks.launch }))
vi.mock('./batch', () => ({ collectSide: mocks.side }))
vi.mock('./manifest', () => ({ discoverManifest: mocks.manifest }))

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

it.each((['cleanup-unconfirmed', 'cancelled'] as const).flatMap(reason => (['prepare', 'manifest', 'first-side', 'after-completed-side'] as const).map(stage => ({ reason, stage }))))('checkpoints $reason from $stage without another smoke launch', async ({ reason, stage }) => {
  vi.resetModules()
  const { CollectorStopError } = await import('./collectorStop')
  const root = await mkdtemp(path.join(os.tmpdir(), 'smoke-performance-stop-'))
  const previousExitCode = process.exitCode
  const stopped = new CollectorStopError(new Error('Original collector failure'), reason === 'cleanup-unconfirmed' ? { error: new Error('Identity unavailable') } : undefined, reason === 'cancelled')
  const headSha = 'a'.repeat(40)
  try {
    vi.stubEnv('TEMPLATES_PERF_REPORT_DIR', root)
    vi.stubEnv('PERFORMANCE_HEAD_SHA', headSha)
    vi.stubEnv('GITHUB_STEP_SUMMARY', '')
    mocks.launch.mockImplementation(async () => {
      if (stage === 'prepare') {
        throw stopped
      }
      await writeFile(path.join(root, 'prepared.json'), JSON.stringify({ optimized: { id: 'optimized', commit: headSha, templates: [] } }))
    })
    mocks.manifest.mockImplementation(async () => {
      if (stage === 'manifest') {
        throw stopped
      }
      return { templates: policy.templates }
    })
    mocks.side.mockImplementation(async (_checkout, shard: string) => ({ values: smokeMetrics(shard).map((id: string) => ({ id, ms: 100 })), errors: [], stop: stopped.stop }))
    if (stage === 'after-completed-side') {
      mocks.side.mockImplementationOnce(async (_checkout, shard: string) => ({ values: smokeMetrics(shard).map((id: string) => ({ id, ms: 100 })), errors: [] }))
    }
    await import('./smoke')
    const report = JSON.parse(await readFile(path.join(root, 'smoke.json'), 'utf8')) as { stages: unknown[], stop: CollectorStop, errors: string[], status: string }
    expect(report.stop).toEqual(stopped.stop)
    expect(report.status).toBe('incomplete')
    expect(report.stages).toHaveLength(stage === 'prepare' || stage === 'manifest' ? 0 : stage === 'first-side' ? 1 : 2)
    expect(mocks.side).toHaveBeenCalledTimes(report.stages.length)
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(mocks.manifest).toHaveBeenCalledTimes(stage === 'prepare' ? 0 : 1)
    expect(process.exitCode).toBe(1)
  }
  finally {
    process.exitCode = previousExitCode
    await rm(root, { recursive: true, force: true })
  }
})

it('does not publish otherwise complete smoke evidence after a collector stop', () => {
  const headSha = 'a'.repeat(40)
  const report = { schemaVersion: 2, purpose: 'smoke', headSha, driverSha: headSha, baselineSha: policy.baselineSha, samplingContract: policy.samplingContract, status: 'passed', fullAcceptance: 'not-run', errors: [], executionPlan: { headOnly: true, confirmation: [], metrics: shards.flatMap(smokeMetrics) }, stages: shards.map(shard => ({ shard, values: smokeMetrics(shard).map((id: string) => ({ id, ms: 100, output: { pageCount: 1, configDigest: 'a'.repeat(64), templateDigest: 'b'.repeat(64) } })) })) }
  expect(() => verifySmoke(report, headSha)).not.toThrow()
  for (const reason of ['cleanup-unconfirmed', 'cancelled'] as const) {
    expect(() => verifySmoke({ ...report, stop: { reason, resourcesReleased: reason === 'cancelled', cancelled: reason === 'cancelled' } }, headSha)).toThrow('Invalid smoke report')
  }
})
