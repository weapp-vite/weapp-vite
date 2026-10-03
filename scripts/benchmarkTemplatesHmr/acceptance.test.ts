import type { AcceptanceOptions, AcceptanceRun, HmrInput } from './acceptanceContract'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateGate } from '../performanceGate/evaluate'
import { collectAcceptanceBatch } from './acceptance'
import { acceptanceOrder, HMR_ACCEPTANCE_BASELINE, HMR_ACCEPTANCE_PAIRS, HMR_INPUTS, pairAcceptanceRuns, parseAcceptanceArgs, readAcceptanceSamples } from './acceptanceContract'
import { acceptanceCollectorEnv, prepareAcceptanceInput, sanitizeAcceptanceText } from './acceptanceRunner'

const directories: string[] = []
const input = HMR_INPUTS[0]
const markerSeed = 'test-pair'
const options: AcceptanceOptions = { baseline: path.resolve('baseline'), candidate: path.resolve('candidate'), candidateSha: 'a'.repeat(40), runtime: 'classic', output: path.resolve('report') }

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

function evidence(profile = true) {
  const raw: unknown[] = []
  let event = 0
  const scenarios = input.scenarios.map((id) => {
    const cycles = Array.from({ length: 2 }, () => {
      const sample = (phase: 'edit' | 'restore') => {
        const producer = { schemaVersion: 1, status: 'complete', timestamp: `sample-${event++}`, totalMs: 20, pipeline: 'standard', eventId: `event-${event}`, batchWaitMs: 2, queueWaitMs: 1, watchToDirtyMs: 5, bundlerMs: 10 }
        raw.push(producer)
        return { ...(profile ? producer : {}), phase, wallMs: 25, inputSha256: 'b'.repeat(64), profileStatus: profile ? 'available' : 'disabled', attribution: { status: profile ? 'complete' : 'partial', phases: { batchWaitMs: profile ? 2 : null, queueWaitMs: profile ? 1 : null, otherBeforeBuildMs: profile ? 2 : null, bundlerMs: profile ? 10 : null } }, outputChanges: { added: [], changed: ['pages/index/index.wxml'], removed: [], changedBytes: 30 } }
      }
      return { edit: sample('edit'), restore: sample('restore') }
    })
    return { id, cycles, samples: cycles.map(cycle => cycle.edit) }
  })
  return { report: { iterations: 2, sampleMode: 'edit-only', markerSeed, outputScopeEnabled: true, profileEnabled: profile, templates: [{ id: input.id, scenarios }] }, raw: profile ? raw.map(row => JSON.stringify(row)).join('\n') : '' }
}

function pairedRuns(): AcceptanceRun[] {
  const { report, raw } = evidence()
  const samples = readAcceptanceSamples(report, raw, input, 'candidate', 'classic', markerSeed)
  return Array.from({ length: HMR_ACCEPTANCE_PAIRS }, (_, round) => acceptanceOrder(round).map(side => ({ round, side, input: input.id, markerSeed, inputDigest: 'c'.repeat(64), samples: structuredClone(samples) }))).flat()
}

describe('HMR attribution acceptance contract', () => {
  it('freezes the specific baseline without accepting shortened samples or duplicate CLI options', () => {
    const args = ['--baseline', 'baseline', '--candidate', 'candidate', '--candidate-sha', 'a'.repeat(40), '--runtime', 'classic', '--output', 'report']
    expect(parseAcceptanceArgs(args)).toEqual(options)
    expect(HMR_ACCEPTANCE_BASELINE).toBe('73b76f4acde84a4ac8c25f4b816119b19704ac28')
    expect(() => parseAcceptanceArgs([...args, '--pairs', '2'])).toThrow('Invalid')
    expect(() => parseAcceptanceArgs([...args, '--runtime', 'classic'])).toThrow('duplicate')
    expect(() => parseAcceptanceArgs(args.map(value => value === 'a'.repeat(40) ? 'abc123' : value))).toThrow('full candidate SHA')
  })

  it('requires candidate attribution to come from the retained raw producer record', () => {
    const { report, raw } = evidence()
    expect(readAcceptanceSamples(report, raw, input, 'candidate', 'classic', markerSeed)).toHaveLength(16)
    expect(() => readAcceptanceSamples(report, '', input, 'candidate', 'classic', markerSeed)).toThrow('raw profile')
    expect(() => readAcceptanceSamples(report, `${raw}\ninvalid`, input, 'candidate', 'classic', markerSeed)).toThrow('raw profile')
    expect(() => readAcceptanceSamples(report, raw, input, 'candidate', 'stateful-experimental', markerSeed)).toThrow('raw producer record')
    report.templates[0]!.scenarios[0]!.cycles[0]!.edit.totalMs = 999
    expect(() => readAcceptanceSamples(report, raw, input, 'candidate', 'classic', markerSeed)).toThrow('raw producer record')
  })

  it('preserves missing historical stateful phases as unknown without failing wall observation', () => {
    const { report, raw } = evidence(false)
    const samples = readAcceptanceSamples(report, raw, input, 'baseline', 'stateful-experimental', markerSeed)
    expect(samples).toHaveLength(16)
    expect(samples.every(sample => sample.profile === 'unknown' && sample.phases.bundlerMs === null && sample.ms === 25)).toBe(true)
    expect(() => readAcceptanceSamples(report, raw, input, 'candidate', 'stateful-experimental', markerSeed)).toThrow('sampling contract')
  })

  it('rejects marker drift, missing scenarios, missing cycles and missing output scopes', () => {
    const first = evidence()
    expect(() => readAcceptanceSamples(first.report, first.raw, input, 'candidate', 'classic', 'different')).toThrow('contract')
    first.report.templates[0]!.scenarios.pop()
    expect(() => readAcceptanceSamples(first.report, first.raw, input, 'candidate', 'classic', markerSeed)).toThrow('manifest')
    const second = evidence()
    second.report.templates[0]!.scenarios[0]!.cycles.pop()
    expect(() => readAcceptanceSamples(second.report, second.raw, input, 'candidate', 'classic', markerSeed)).toThrow('cycles')
    const third = evidence()
    Reflect.deleteProperty(third.report.templates[0]!.scenarios[0]!.cycles[0]!.edit, 'outputChanges')
    expect(() => readAcceptanceSamples(third.report, third.raw, input, 'candidate', 'classic', markerSeed)).toThrow('evidence')
  })

  it('rejects duplicate rounds, changed fixture bytes and fewer than 20 pairs', () => {
    const runs = pairedRuns()
    expect(evaluateGate(pairAcceptanceRuns(runs, [input])).status).toBe('passed')
    expect(evaluateGate(pairAcceptanceRuns(runs.slice(1), [input])).status).toBe('incomplete')
    expect(evaluateGate(pairAcceptanceRuns([...runs, runs[0]!], [input])).status).toBe('incomplete')
    runs[1]!.inputDigest = 'different'
    expect(evaluateGate(pairAcceptanceRuns(runs, [input])).status).toBe('incomplete')
    runs[1]!.inputDigest = runs[0]!.inputDigest
    runs[1]!.samples[0]!.inputSha256 = 'd'.repeat(64)
    expect(evaluateGate(pairAcceptanceRuns(runs, [input])).status).toBe('incomplete')
  })

  it('uses the existing 5 percent and one equal-size confirmation policy', () => {
    const runs = pairedRuns()
    for (const run of runs.filter(run => run.side === 'candidate')) {
      run.samples.forEach(sample => sample.ms *= 1.1)
    }
    const primary = pairAcceptanceRuns(runs, [input])
    expect(evaluateGate(primary).status).toBe('incomplete')
    expect(evaluateGate(primary, primary).status).toBe('regression')
    expect(evaluateGate(primary, pairAcceptanceRuns(pairedRuns(), [input])).status).toBe('unstable')
  })

  it('keeps profiling waits for candidate and classic while scrubbing inherited diagnostic overrides', () => {
    vi.stubEnv('TEMPLATES_HMR_ITERATIONS', '1')
    vi.stubEnv('WEAPP_VITE_DISABLE_SIDECAR_WATCH', '1')
    const env = acceptanceCollectorEnv(options, 'candidate', input, 'report', 'project', 'workspace', markerSeed)
    expect(env.TEMPLATES_HMR_ITERATIONS).toBe('2')
    expect(env.TEMPLATES_HMR_PROFILE_TIMEOUT_MS).toBe('15000')
    expect(env.WEAPP_VITE_DISABLE_SIDECAR_WATCH).toBeUndefined()
    expect(env.TEMPLATES_HMR_PROFILE).toBe('1')
    expect(acceptanceCollectorEnv({ ...options, runtime: 'stateful-experimental' }, 'baseline', input, 'report', 'project', 'workspace', markerSeed).TEMPLATES_HMR_PROFILE).toBe('0')
    expect(sanitizeAcceptanceText('C:\\work\\project\\file /checkout/file', ['C:\\work\\project', '/checkout'])).toBe('<workspace>\\file <workspace>/file')
  })

  it('collects serial alternating pairs and checkpoints a failure without retrying it', async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'hmr-acceptance-test-'))
    directories.push(output)
    const calls: string[] = []
    let active = false
    const collector = vi.fn(async (_options: AcceptanceOptions, side: AcceptanceRun['side'], selected: HmrInput, round: number): Promise<AcceptanceRun> => {
      expect(active).toBe(false)
      active = true
      calls.push(`${round}:${side}`)
      await Promise.resolve()
      active = false
      return { round, side, input: selected.id, markerSeed, samples: [], ...(round === 2 && side === 'baseline' ? { error: 'owned collector failed' } : {}) }
    })
    const runs = await collectAcceptanceBatch({ ...options, output }, [input], 'primary', Date.now() + 60_000, collector)
    expect(calls).toEqual(['0:baseline', '0:candidate', '1:candidate', '1:baseline', '2:baseline'])
    expect(runs.at(-1)?.error).toBe('owned collector failed')
    expect(JSON.parse(await readFile(path.join(output, 'primary.json'), 'utf8'))).toEqual(runs)
  })

  it('stages identical candidate inputs with dependencies resolved from each owning checkout', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-acceptance-isolation-'))
    directories.push(root)
    const currentOptions = { ...options, baseline: path.join(root, 'baseline'), candidate: path.join(root, 'candidate') }
    const source = path.join(currentOptions.candidate, input.source)
    await mkdir(path.join(source, 'src'), { recursive: true })
    await writeFile(path.join(source, 'src/index.vue'), '<template><view>same input</view></template>')
    await writeFile(path.join(source, 'package.json'), '{"name":"input","private":true}')
    for (const side of ['baseline', 'candidate'] as const) {
      const modules = path.join(currentOptions[side], input.dependencies, 'node_modules')
      await mkdir(modules, { recursive: true })
      for (const [name, directory] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']]) {
        const packageRoot = path.join(currentOptions[side], directory!)
        await mkdir(packageRoot, { recursive: true })
        await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name, version: side === 'baseline' ? '1.0.0' : '2.0.0' }))
        await symlink(packageRoot, path.join(modules, name!), 'junction')
      }
    }
    const baseline = await prepareAcceptanceInput(currentOptions, 'baseline', input)
    const candidate = await prepareAcceptanceInput(currentOptions, 'candidate', input)
    expect(baseline.manifest).toEqual(candidate.manifest)
    expect(baseline.packageManifestSha256).not.toBe(candidate.packageManifestSha256)
    expect(await realpath(path.join(baseline.project, 'node_modules/weapp-vite'))).toBe(await realpath(path.join(currentOptions.baseline, 'packages/weapp-vite')))
    await rm(path.join(currentOptions.baseline, input.dependencies, 'node_modules/weapp-vite'))
    await symlink(path.join(currentOptions.candidate, 'packages/weapp-vite'), path.join(currentOptions.baseline, input.dependencies, 'node_modules/weapp-vite'), 'junction')
    await expect(prepareAcceptanceInput(currentOptions, 'baseline', input)).rejects.toThrow('outside its owning checkout')
  })
})
