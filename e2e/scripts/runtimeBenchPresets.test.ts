import type { BenchUpdateSample, BenchUpdateSummary, WorkerResult } from './runtimeBench/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertEquivalentBenchConsumers, assessBenchMemory } from './runtimeBench/acceptance'
import { runPublishedPresetBench } from './runtimeBench/presets'

const mocks = vi.hoisted(() => ({ execa: vi.fn(), temporaryRoot: vi.fn(), consumer: vi.fn(), pack: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execa }))
vi.mock('../../packages/weapp-vite/scripts/consumerTarballs.mjs', () => ({ createConsumerTemporaryRoot: mocks.temporaryRoot, packConsumerTarballs: mocks.pack }))
vi.mock('./runtimeBench/consumer', () => ({ createRuntimeBenchConsumer: mocks.consumer }))

const diagnostics = {
  flushes: 1,
  patchFlushes: 1,
  diffFlushes: 0,
  fallbackFlushes: 0,
  avgPayloadKeys: 1,
  maxPayloadKeys: 1,
  avgPendingPatchKeys: 1,
  maxPendingPatchKeys: 1,
  avgBytes: 10,
  maxBytes: 10,
}

function workerResult(preset: string, supported = true): WorkerResult {
  const snapshot = {
    provider: 'devtools',
    toolVersion: 'test-ide',
    sdkVersion: 'test-sdk',
    usage: supported
      ? { status: 'available' as const, source: 'appservice-cdp-runtime' as const, usedSize: 40, totalSize: 100 }
      : { status: 'unsupported' as const, source: 'appservice-cdp-runtime' as const, reason: 'protocol-unimplemented' as const },
  }
  const sample: BenchUpdateSample = {
    wallMs: 4,
    metricMs: 2,
    computeMs: 1,
    commitMs: 1,
    dispatchMs: 1,
    flushMs: 1,
    setDataCalls: 1,
    setDataDiagnostics: diagnostics,
    memory: {
      workerRssBefore: 100,
      workerRssAfter: 110,
      hostHeapBytes: supported ? 40 : null,
      hostHeapCapability: supported ? 'available' : 'unavailable',
      hostHeapBefore: snapshot,
      hostHeapAfter: snapshot,
    },
  }
  const update: BenchUpdateSummary = {
    wallMsMedian: 4,
    metricMsMedian: 2,
    computeMsMedian: 1,
    commitMsMedian: 1,
    dispatchMsMedian: 1,
    flushMsMedian: 1,
    setDataCallsMedian: 1,
    setDataDiagnosticsMedian: diagnostics,
    fallbackReasons: {},
    samples: Array.from({ length: 3 }, () => structuredClone(sample)),
  }
  const scenario = { wallMsMedian: 10, readyMsMedian: 5, firstCommitMsMedian: null, samples: [{ wallMs: 10, readyMs: 5, firstCommitMs: null }] }
  return {
    schemaVersion: 2,
    project: 'runtime-bench-vue',
    preset,
    firstScreen: scenario,
    detailNavigation: scenario,
    updateSingleCommit: { diff: update, patch: update },
    updateMicroCommit: { diff: update, patch: update },
    workloads: Object.fromEntries(['small-field', 'batch', 'append', 'reorder'].map(name => [name, update])),
  }
}

let sandbox: string
let consumerRoot: string
let output: string
let supported: boolean
let failure: 'sample' | 'cleanup' | undefined
let drift: boolean

beforeEach(async () => {
  vi.clearAllMocks()
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-bench-presets-unit-'))
  consumerRoot = path.join(sandbox, 'consumers')
  output = path.join(sandbox, 'report.json')
  supported = true
  failure = undefined
  drift = false
  mocks.temporaryRoot.mockResolvedValue(consumerRoot)
  mocks.consumer.mockImplementation(async ({ root }: { root: string }) => {
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(path.join(root, 'retained-input.vue'), '<view />')
    return {
      cliPath: path.join(root, 'node_modules/weapp-vite/bin/weapp-vite.js'),
      sourceHash: 'source',
      archiveHash: 'archive',
      archives: [],
      installMs: 1,
      installedClosure: [{ location: 'node_modules/vue', version: drift && path.basename(root) === 'performance' ? 'different' : 'same', integrity: 'sha512-test' }],
    }
  })
  mocks.execa.mockImplementation(async (command: string, _args: string[], options: { env?: Record<string, string> }) => {
    if (command === 'git') {
      return { stdout: 'test-commit' }
    }
    const preset = options.env!.WEVU_BENCH_PRESET!
    const result = workerResult(preset, supported)
    const evidence = {
      schemaVersion: 1,
      status: failure ? 'failed' : 'passed',
      samples: [{ scenario: 'firstScreen', index: 0, sample: result.firstScreen.samples![0] }],
      failures: failure === 'sample' ? ['later sample failed'] : [],
      cleanupErrors: failure === 'cleanup' ? ['owned close failed'] : [],
      result: failure === 'sample' ? undefined : result,
    }
    await fs.writeFile(options.env!.WEVU_BENCH_EVIDENCE_PATH!, JSON.stringify(evidence))
    if (failure) {
      throw new Error(`worker ${failure} failed`)
    }
    return { stdout: `RUNTIME_BENCH_RESULT ${JSON.stringify(result)}\n` }
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(sandbox, { recursive: true, force: true })
})

const run = () => runPublishedPresetBench({ repoRoot: sandbox, provider: 'devtools', tarballDirectory: path.join(sandbox, 'tarballs'), output })
const report = async () => JSON.parse(await fs.readFile(output, 'utf8')) as Awaited<ReturnType<typeof runPublishedPresetBench>>

describe('published benchmark acceptance and retention', () => {
  it('compares the full installed closure independently of lockfile ordering', () => {
    const a = { sourceHash: 'src', archiveHash: 'tgz', installedClosure: [{ location: 'a', version: '1', integrity: 'x' }, { location: 'b', version: '2', integrity: 'y' }] }
    expect(() => assertEquivalentBenchConsumers(a, { ...a, installedClosure: [...a.installedClosure].reverse() })).not.toThrow()
    expect(() => assertEquivalentBenchConsumers(a, { ...a, installedClosure: [{ ...a.installedClosure[0]!, integrity: 'changed' }, a.installedClosure[1]!] })).toThrow('dependency closures differ')
  })

  it('rejects closure drift before the second preset is sampled and retains both inputs', async () => {
    drift = true
    await expect(run()).rejects.toThrow('dependency closures differ')
    const saved = await report()
    expect(saved.complete).toBe(false)
    expect(saved.equivalentInputs).toBe(false)
    expect(saved.results.normal?.evidence?.samples).toHaveLength(1)
    expect(mocks.execa.mock.calls.filter(([command]) => command !== 'git')).toHaveLength(1)
    await expect(fs.access(path.join(consumerRoot, 'performance/retained-input.vue'))).resolves.toBeUndefined()
  })

  it('separates finished collection from missing memory evidence with the true host reason', async () => {
    supported = false
    const saved = await run()
    expect(saved).toMatchObject({ collectionComplete: true, complete: false, cleanup: { consumers: 'retained' } })
    expect(saved.memoryEvidence.normal).toMatchObject({ complete: false, samples: 24 })
    expect(saved.memoryEvidence.normal!.missing).toHaveLength(48)
    expect(saved.memoryEvidence.normal!.missing.every(item => item.reason === 'protocol-unimplemented')).toBe(true)
    expect(saved.results.normal!.result!.firstScreen.firstCommitMsMedian).toBeNull()
    expect(assessBenchMemory(undefined).complete).toBe(false)
    await expect(fs.access(consumerRoot)).resolves.toBeUndefined()
  })

  it.each(['sample', 'cleanup'] as const)('archives partial evidence and retains consumers after %s failure', async (kind) => {
    failure = kind
    await expect(run()).rejects.toThrow(`worker ${kind} failed`)
    const saved = await report()
    expect(saved.complete).toBe(false)
    expect(saved.results.normal?.evidence?.samples).toHaveLength(1)
    expect(saved.cleanup.errors).toEqual(kind === 'cleanup' ? ['normal: owned close failed'] : [])
    await expect(fs.access(path.join(consumerRoot, 'normal/retained-input.vue'))).resolves.toBeUndefined()
  })

  it('does not remove any consumer if the final evidence archive fails', async () => {
    const rename = fs.rename.bind(fs)
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (to === output) {
        throw Object.assign(new Error('report archive denied'), { code: 'EACCES' })
      }
      await rename(from, to)
    })
    await expect(run()).rejects.toThrow('report archive denied')
    await expect(fs.access(path.join(consumerRoot, 'normal/runtime-bench-evidence.json'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(consumerRoot, 'performance/runtime-bench-evidence.json'))).resolves.toBeUndefined()
  })

  it('archives all evidence before removing only its owned consumers', async () => {
    const unrelated = path.join(sandbox, 'manual-host')
    await fs.mkdir(unrelated)
    expect(await run()).toMatchObject({ complete: true, collectionComplete: true, equivalentInputs: true, cleanup: { consumers: 'removed', errors: [] } })
    expect((await report()).results.performance?.evidence?.status).toBe('passed')
    await expect(fs.access(consumerRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(unrelated)).resolves.toBeUndefined()
    expect(mocks.pack).not.toHaveBeenCalled()
  })

  it('records a consumer cleanup error in the archived report without reporting completion', async () => {
    const remove = fs.rm.bind(fs)
    vi.spyOn(fs, 'rm').mockImplementation(async (target, options) => {
      if (target === consumerRoot) {
        throw new Error('consumer directory still locked')
      }
      await remove(target, options)
    })
    await expect(run()).rejects.toThrow('consumer directory still locked')
    expect(await report()).toMatchObject({ complete: false, collectionComplete: true, cleanup: { consumers: 'retained', errors: ['consumer directory still locked'] } })
    await expect(fs.access(consumerRoot)).resolves.toBeUndefined()
  })
})
