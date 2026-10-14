import type { AcceptanceOptions, AcceptanceRun, HmrInput } from './acceptanceContract'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { CollectorStopError } from '../performanceGate/collectorStop'
import { collectAcceptanceBatch, runHmrAttributionAcceptance } from './acceptance'
import { HMR_INPUTS } from './acceptanceContract'

const mocks = vi.hoisted(() => ({ collect: vi.fn(), verify: vi.fn(), rebuild: vi.fn(), manifest: vi.fn() }))
vi.mock('./acceptanceRunner', async original => ({ ...await original<object>(), collectAcceptanceRun: mocks.collect, verifyAcceptanceCheckout: mocks.verify, rebuildAcceptanceCheckouts: mocks.rebuild, acceptanceInputManifest: mocks.manifest }))
const directories: string[] = []
const candidate = fileURLToPath(new URL('../..', import.meta.url))

afterEach(async () => {
  vi.resetAllMocks()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function options(createOutput = true): Promise<AcceptanceOptions> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-acceptance-stop-'))
  directories.push(root)
  const output = path.join(root, 'report')
  const baseline = path.join(root, 'baseline')
  await mkdir(baseline)
  if (createOutput) {
    await mkdir(output)
  }
  return { baseline, candidate, candidateSha: 'a'.repeat(40), runtime: 'classic', output }
}

function failure(reason: 'cleanup-unconfirmed' | 'cancelled') {
  return new CollectorStopError(new Error('Original collector failure'), reason === 'cleanup-unconfirmed' ? { error: new Error('Identity unavailable') } : undefined, reason === 'cancelled')
}

it.each(['cleanup-unconfirmed', 'cancelled'] as const)('checkpoints %s and stops every following input', async (reason) => {
  const config = await options()
  const stopped = failure(reason)
  const collect = vi.fn(async (_options: AcceptanceOptions, side: AcceptanceRun['side'], input: HmrInput, round: number): Promise<AcceptanceRun> => ({ round, side, input: input.id, markerSeed: 'pair', samples: [], error: String(stopped), stop: stopped.stop }))
  const runs = await collectAcceptanceBatch(config, HMR_INPUTS, 'primary', Date.now() + 60_000, collect)
  expect(collect).toHaveBeenCalledTimes(1)
  expect(runs).toHaveLength(1)
  expect(runs[0]).toHaveProperty('stop', stopped.stop)
  expect(JSON.parse(await readFile(path.join(config.output, 'primary.json'), 'utf8')) as unknown).toEqual(runs)
})

it('keeps a thrown collector stop while preserving ordinary per-input failure continuation', async () => {
  const config = await options()
  const stopped = failure('cleanup-unconfirmed')
  const collect = vi.fn<(...args: Parameters<typeof mocks.collect>) => Promise<AcceptanceRun>>().mockRejectedValueOnce(stopped)
  const runs = await collectAcceptanceBatch(config, HMR_INPUTS, 'primary', Date.now() + 60_000, collect)
  expect(collect).toHaveBeenCalledTimes(1)
  expect(runs[0]).toHaveProperty('stop', stopped.stop)
  collect.mockReset().mockImplementation(async (_options, side, input, round) => ({ round, side, input: input.id, markerSeed: 'pair', samples: [], ...(input === HMR_INPUTS[0] ? { error: 'Ordinary completed cleanup failure' } : {}) }))
  const partial = await collectAcceptanceBatch(config, HMR_INPUTS, 'ordinary', Date.now() + 60_000, collect)
  expect(collect).toHaveBeenCalledTimes(41)
  expect(partial).toHaveLength(41)
  expect(partial.every(run => !run.stop)).toBe(true)
})

it.each(['cleanup-unconfirmed', 'cancelled'] as const)('retains earlier complete regression samples without confirming after %s', async (reason) => {
  const config = await options(false)
  const stopped = failure(reason)
  const manifest = { 'source.ts': 'b'.repeat(64) }
  const inputDigest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
  mocks.manifest.mockResolvedValue(manifest)
  mocks.collect.mockImplementation(async (_options, side: AcceptanceRun['side'], input: HmrInput, round: number): Promise<AcceptanceRun> => ({
    round,
    side,
    input: input.id,
    markerSeed: `pair-${round}`,
    ...(input === HMR_INPUTS[0] ? { inputDigest } : {}),
    samples: input === HMR_INPUTS[0] ? input.scenarios.flatMap(scenario => ['first', 'repeat'].flatMap(cycle => ['edit', 'restore'].map(phase => ({ id: `${input.id}:${scenario}:${cycle}:${phase}`, ms: side === 'baseline' ? 100 : 110, inputSha256: 'c'.repeat(64), profile: 'available' as const, phases: {}, outputChanges: { added: [], changed: [], removed: [], changedBytes: 0 } })))) : [],
    ...(input === HMR_INPUTS[1] ? { error: String(stopped), stop: stopped.stop } : {}),
  }))
  await expect(runHmrAttributionAcceptance(config)).rejects.toThrow('incomplete')
  const report = JSON.parse(await readFile(path.join(config.output, 'report.json'), 'utf8')) as { primary: AcceptanceRun[], confirmation: AcceptanceRun[], confirmationInputs: string[] }
  expect(mocks.collect).toHaveBeenCalledTimes(41)
  expect(report.primary).toHaveLength(41)
  expect(report.primary.at(-1)?.error).toContain('Original collector failure')
  expect(report).toHaveProperty('stop', stopped.stop)
  expect(report.confirmationInputs).toEqual([])
  expect(report.confirmation).toEqual([])
})

it.each(['cleanup-unconfirmed', 'cancelled'] as const)('preserves %s during preparation without launching an input', async (reason) => {
  const config = await options(false)
  const stopped = failure(reason)
  mocks.rebuild.mockRejectedValue(stopped)
  await expect(runHmrAttributionAcceptance(config)).rejects.toThrow('incomplete')
  expect(mocks.collect).not.toHaveBeenCalled()
  expect(mocks.manifest).not.toHaveBeenCalled()
  const report = JSON.parse(await readFile(path.join(config.output, 'report.json'), 'utf8')) as unknown
  expect(report).toMatchObject({ stop: stopped.stop, primary: [], confirmation: [], confirmationInputs: [], status: 'incomplete' })
})
