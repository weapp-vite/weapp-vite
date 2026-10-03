import type { HmrProfileJsonSample } from '../../packages/weapp-vite/src/analyze/hmr'
import type { GateScenario } from '../performanceGate/evaluate'
import path from 'node:path'
import { attributeHmrProfile } from '../../packages/weapp-vite/src/analyze/hmr/attribution'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'

export const HMR_ACCEPTANCE_BASELINE = '73b76f4acde84a4ac8c25f4b816119b19704ac28'
export const HMR_ACCEPTANCE_PAIRS = 20
export const HMR_ACCEPTANCE_CONTRACT = 'hmr-attribution-paired-v1'
export const HMR_INPUTS = [
  { id: 'weapp-vite-wevu-template', source: 'templates/weapp-vite-wevu-template', dependencies: 'templates/weapp-vite-wevu-template', scenarios: ['vue-page-script', 'vue-page-style', 'vue-page-template', 'vue-page-json-macro'] },
  { id: 'issue-1134-profile', source: 'e2e-apps/github-issues/fixtures/issue-1134-profile', dependencies: 'e2e-apps/github-issues', scenarios: ['native-script', 'native-template', 'plain-wxss', 'import-chain-wxss', 'scss', 'tailwind-content', 'local-json', 'component-topology-json', 'route-topology-json'] },
] as const
export type HmrInput = typeof HMR_INPUTS[number]
export type HmrSide = 'baseline' | 'candidate'
export type HmrRuntime = 'classic' | 'stateful-experimental'
export interface AcceptanceOptions { baseline: string, candidate: string, candidateSha: string, runtime: HmrRuntime, output: string }
export interface AcceptanceSample {
  id: string
  ms: number
  inputSha256: string
  profile: 'available' | 'unknown'
  phases: Record<string, number | null>
  outputChanges: { added: string[], changed: string[], removed: string[], changedBytes: number }
}
export interface AcceptanceRun { round: number, side: HmrSide, input: string, markerSeed: string, inputDigest?: string, samples: AcceptanceSample[], error?: string }

export function parseAcceptanceArgs(args: string[]): AcceptanceOptions {
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!
    const value = args[index + 1]
    if (!['--baseline', '--candidate', '--candidate-sha', '--runtime', '--output'].includes(key) || !value || value.startsWith('--') || values.has(key)) {
      throw new Error(`Invalid or duplicate acceptance option: ${key}`)
    }
    values.set(key, value)
  }
  const candidateSha = values.get('--candidate-sha') ?? ''
  const runtime = values.get('--runtime')
  if (values.size !== 5 || !/^[a-f\d]{40}$/.test(candidateSha) || !['classic', 'stateful-experimental'].includes(runtime ?? '')) {
    throw new Error('Require baseline/candidate checkouts, full candidate SHA, runtime and a new output directory')
  }
  const baseline = path.resolve(values.get('--baseline')!)
  const candidate = path.resolve(values.get('--candidate')!)
  if (baseline === candidate || candidateSha === HMR_ACCEPTANCE_BASELINE) {
    throw new Error('Baseline and candidate must be distinct checkouts and commits')
  }
  return { baseline, candidate, candidateSha, runtime: runtime as HmrRuntime, output: path.resolve(values.get('--output')!) }
}

export function acceptanceOrder(round: number): HmrSide[] {
  return round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
}

export function baselineProfileAvailable(side: HmrSide, runtime: HmrRuntime) {
  // 固定历史提交没有 stateful profile producer；不修改历史源码，也不补造阶段。
  return side !== 'baseline' || runtime !== 'stateful-experimental'
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid HMR acceptance evidence')
  }
  return value as Record<string, unknown>
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function matchesRawProfile(raw: HmrProfileJsonSample, sample: Record<string, unknown>) {
  return typeof sample.timestamp === 'string' && raw.timestamp === sample.timestamp && raw.totalMs === sample.totalMs
    && raw.pipeline === sample.pipeline && raw.eventId === sample.eventId && raw.batchId === sample.batchId
}

/** 报告与原始 JSONL 双向对照；旧生产者缺少阶段时明确保留 unknown。 */
export function readAcceptanceSamples(value: unknown, rawProfile: string, input: HmrInput, side: HmrSide, runtime: HmrRuntime, markerSeed: string): AcceptanceSample[] {
  const report = object(value)
  const profileExpected = baselineProfileAvailable(side, runtime)
  if (report.iterations !== 2 || report.sampleMode !== 'edit-only' || report.markerSeed !== markerSeed || report.outputScopeEnabled !== true || report.profileEnabled !== profileExpected || !Array.isArray(report.templates) || report.templates.length !== 1) {
    throw new Error('Collector sampling contract changed')
  }
  const template = object(report.templates[0])
  if (template.id !== input.id || template.error || !Array.isArray(template.scenarios)) {
    throw new Error('HMR project failed or is missing')
  }
  const rows = template.scenarios.map(object)
  if (rows.length !== input.scenarios.length || new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => !input.scenarios.includes(row.id as never))) {
    throw new Error('HMR scenario manifest changed')
  }
  const raw = readHmrProfileLines(rawProfile)
  if (side === 'candidate' && (!raw.samples.length || raw.skippedLineCount)) {
    throw new Error('Candidate raw profile is missing, invalid or incomplete')
  }
  const samples: AcceptanceSample[] = []
  const usedRawRecords = new Set<HmrProfileJsonSample>()
  for (const row of rows) {
    if (row.error || !Array.isArray(row.samples) || row.samples.length !== 2 || !Array.isArray(row.cycles) || row.cycles.length !== 2) {
      throw new Error(`Incomplete HMR cycles: ${row.id}`)
    }
    for (const [index, cycleValue] of row.cycles.entries()) {
      const cycle = object(cycleValue)
      for (const phase of ['edit', 'restore'] as const) {
        const sample = object(cycle[phase])
        const changes = object(sample.outputChanges)
        if (sample.phase !== phase || typeof sample.wallMs !== 'number' || !Number.isFinite(sample.wallMs) || sample.wallMs <= 0 || typeof sample.inputSha256 !== 'string' || !/^[a-f\d]{64}$/.test(sample.inputSha256) || !strings(changes.added) || !strings(changes.changed) || !strings(changes.removed) || typeof changes.changedBytes !== 'number') {
          throw new Error(`Missing input, output scope or timing: ${row.id}/${phase}`)
        }
        const available = sample.profileStatus === 'available'
        const attribution = object(sample.attribution)
        const phases = object(attribution.phases)
        const matchingRecords = raw.samples.filter(rawSample => matchesRawProfile(rawSample, sample))
        const matchingRaw = matchingRecords.length === 1 ? matchingRecords[0] : undefined
        const attributedRaw = matchingRaw ? attributeHmrProfile(matchingRaw) : undefined
        if (side === 'candidate' && (!available || !matchingRaw || usedRawRecords.has(matchingRaw) || matchingRaw.schemaVersion !== 1 || matchingRaw.status !== 'complete' || matchingRaw.pipeline !== (runtime === 'classic' ? 'standard' : 'stateful') || attribution.status !== 'complete' || attributedRaw?.status !== 'complete' || JSON.stringify(Object.entries(phases).sort()) !== JSON.stringify(Object.entries(attributedRaw.phases).sort()))) {
          throw new Error(`Candidate attribution has no complete raw producer record: ${row.id}/${phase}`)
        }
        if (matchingRaw) {
          usedRawRecords.add(matchingRaw)
        }
        samples.push({ id: `${input.id}:${row.id}:${index ? 'repeat' : 'first'}:${phase}`, ms: sample.wallMs, inputSha256: sample.inputSha256, profile: available && matchingRaw ? 'available' : 'unknown', phases: phases as Record<string, number | null>, outputChanges: changes as AcceptanceSample['outputChanges'] })
      }
    }
  }
  return samples
}

/** 每个场景按轮次和输入 hash 配对；缺样本、重复或 marker 漂移均不可通过。 */
export function pairAcceptanceRuns(runs: AcceptanceRun[], inputs: readonly HmrInput[]): GateScenario[] {
  const invalidOwnership = runs.some(run => !Number.isInteger(run.round) || run.round < 0 || run.round >= HMR_ACCEPTANCE_PAIRS || !['baseline', 'candidate'].includes(run.side) || !inputs.some(input => input.id === run.input))
  return inputs.flatMap(input => input.scenarios.flatMap(scenario => ['first', 'repeat'].flatMap(cycle => ['edit', 'restore'].map((phase) => {
    const id = `${input.id}:${scenario}:${cycle}:${phase}`
    const pairs: GateScenario['pairs'] = []
    let error = invalidOwnership ? 'Unexpected sample ownership or round' : undefined
    for (let round = 0; round < HMR_ACCEPTANCE_PAIRS; round++) {
      const sides = (['baseline', 'candidate'] as const).map(side => runs.filter(run => run.input === input.id && run.round === round && run.side === side))
      const [before, after] = sides.map(side => side[0])
      const [a, b] = [before, after].map(run => run?.samples.filter(sample => sample.id === id) ?? [])
      if (sides.some(side => side.length !== 1) || before?.error || after?.error || !before?.inputDigest || before.inputDigest !== after?.inputDigest || before?.markerSeed !== after?.markerSeed || a!.length !== 1 || b!.length !== 1 || a![0]!.inputSha256 !== b![0]!.inputSha256) {
        error = 'Missing, duplicate or unequal input/marker evidence'
        continue
      }
      pairs.push({ baseline: a![0]!.ms, current: b![0]!.ms })
    }
    return { id, requiredPairs: HMR_ACCEPTANCE_PAIRS, pairs, error }
  }))))
}
