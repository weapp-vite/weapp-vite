import type { CollectorStop } from './collectorStop'
import type { AuditBatch } from './report'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { frozenManifest, metricsForShard, policy } from './contract.mjs'

const mocks = vi.hoisted(() => ({ launch: vi.fn(), batch: vi.fn(), manifest: vi.fn(), execute: vi.fn() }))
vi.mock('./process', () => ({ runCollector: mocks.launch }))
vi.mock('./batch', async original => ({ ...await original<object>(), collectShardBatch: mocks.batch }))
vi.mock('./manifest', () => ({ discoverManifest: mocks.manifest }))
vi.mock('execa', () => ({ execa: mocks.execute }))

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

it.each((['cleanup-unconfirmed', 'cancelled'] as const).flatMap(reason => (['prepare', 'manifest', 'primary'] as const).map(stage => ({ reason, stage }))))('writes a $reason checkpoint after $stage without dispatching confirmation', async ({ reason, stage }) => {
  vi.resetModules()
  const { CollectorStopError } = await import('./collectorStop')
  const root = await mkdtemp(path.join(os.tmpdir(), 'full-performance-stop-'))
  const previousExitCode = process.exitCode
  const shard = 'hmr:classic:weapp-vite-template'
  const metrics: string[] = metricsForShard(shard)
  const driverSha = 'b'.repeat(40)
  const headSha = 'a'.repeat(40)
  const system = { linux: 'ubuntu-latest', win32: 'windows-latest', darwin: 'macos-latest' }[process.platform as 'linux' | 'win32' | 'darwin']
  const stop: CollectorStop = { reason, resourcesReleased: reason === 'cancelled', cancelled: reason === 'cancelled' }
  const stopped = new CollectorStopError(new Error('Original collector failure'), reason === 'cleanup-unconfirmed' ? { error: new Error('Identity unavailable') } : undefined, reason === 'cancelled')
  const primary: AuditBatch = {
    errors: ['Collector stopped after completed evidence'],
    stop,
    samples: Array.from({ length: 20 }, (_, round) => (['baseline', 'optimized'] as const).map(side => ({ round, side, values: metrics.map(id => ({ id, ms: side === 'baseline' ? 100 : 110, phase: 'first', template: 'weapp-vite-template' })) }))).flat(),
  }
  try {
    const planFile = path.join(root, 'plan.json')
    await writeFile(planFile, JSON.stringify({ driverSha, samplingContract: policy.samplingContract, manifest: frozenManifest(), targets: [{ id: 'target', headSha, baselineSha: policy.baselineSha }], matrix: [{ target: 'target', shard, os: system }] }))
    vi.stubEnv('TEMPLATES_PERF_REPORT_DIR', root)
    vi.stubEnv('PERFORMANCE_PLAN', planFile)
    vi.stubEnv('PERFORMANCE_TARGET', 'target')
    vi.stubEnv('PERFORMANCE_SHARD', shard)
    vi.stubEnv('PERFORMANCE_OS', system)
    vi.stubEnv('GITHUB_RUN_ATTEMPT', '1')
    vi.stubEnv('GITHUB_STEP_SUMMARY', '')
    mocks.execute.mockResolvedValue({ stdout: driverSha })
    mocks.launch.mockImplementation(async () => {
      if (stage === 'prepare') {
        throw stopped
      }
      await writeFile(path.join(root, 'prepared.json'), JSON.stringify({ baseline: { id: 'baseline', commit: policy.baselineSha, templates: [] }, optimized: { id: 'optimized', commit: headSha, templates: [] } }))
    })
    mocks.manifest.mockImplementation(async () => {
      if (stage === 'manifest') {
        throw stopped
      }
      return { templates: policy.templates }
    })
    mocks.batch.mockResolvedValue(primary)
    await import('./full')
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(mocks.batch).toHaveBeenCalledTimes(stage === 'primary' ? 1 : 0)
    expect(mocks.manifest).toHaveBeenCalledTimes(stage === 'prepare' ? 0 : 1)
    if (stage === 'primary') {
      expect(mocks.batch.mock.calls[0]![3]).toBe('primary')
    }
    const report = JSON.parse(await readFile(path.join(root, 'report.json'), 'utf8')) as { primary: AuditBatch, confirmation?: AuditBatch, executionPlan: { confirmation: string[] }, gate: { status: string } }
    expect(report.primary.stop).toEqual(stop)
    expect(report.primary.samples).toHaveLength(stage === 'primary' ? 40 : 0)
    expect(report.executionPlan.confirmation).toEqual([])
    expect(report.confirmation).toBeUndefined()
    expect(report.gate.status).toBe('incomplete')
    expect(process.exitCode).toBe(1)
  }
  finally {
    process.exitCode = previousExitCode
    await rm(root, { recursive: true, force: true })
  }
})
