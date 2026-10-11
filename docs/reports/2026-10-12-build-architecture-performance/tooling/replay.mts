import type { Options, Run } from '../../../../scripts/benchmarkNativeAnalysis/contract.ts'
import type { GateScenario, TimingPair } from '../../../../scripts/performanceGate/evaluate.ts'
import type { CollectionReport, PortablePayload } from './schema.mts'
import assert from 'node:assert/strict'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isArtifactEvidence } from '../../../../scripts/benchmarkNativeAnalysis/artifacts.ts'
import { expectedSamples, INPUTS, TARGET } from '../../../../scripts/benchmarkNativeAnalysis/contract.ts'
import { confirmationInputs, pairRuns } from '../../../../scripts/benchmarkNativeAnalysis/evaluate.ts'
import { evaluateGate, summarizePairs } from '../../../../scripts/performanceGate/evaluate.ts'
import { readPublicEvidence } from './publicFiles.mts'
import { replayProvenance } from './replayProvenance.mts'
import { replayRetainedEvidence } from './retainedContract.mts'

interface Issue { reason: string }
interface RawPair { pair: number, baseline?: number | null, current?: number | null, duplicate?: boolean }
interface Evaluation {
  contract: string
  status: string
  formalAcceptance: string
  performanceConclusion: string
  identity: { sha256: string, baselineCommit: string, inputIdentities: Record<string, string> }
  issues: unknown[]
  parity: unknown[]
  metrics: unknown
  rawStatistics: unknown
  target: unknown
  requiredConfirmation: string[]
  regression: unknown
  preregistration: unknown
}
const BASELINE_COMMIT = '419f49d914142a591d5e109fcb3010feed66ab19'
const variants = [{ id: 'baseline-off', runtime: 'baseline', native: 'off' }, { id: 'candidate-off', runtime: 'candidate', native: 'off' }]
const primaryScope = INPUTS.flatMap(input => [...(input.build ? [`build:${input.id}`] : []), `hmr:${input.id}`])
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const percent = (before: number | null, after: number | null) => before !== null && before > 0 && after !== null && Number.isFinite(after) ? (after - before) / before * 100 : null

function object(value: unknown, description: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `Missing ${description}`)
  return value as Record<string, unknown>
}

function fileDifferences(a: Record<string, string>, b: Record<string, string>) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter(file => a[file] !== b[file]).map(file => ({ file, baseline: a[file] ?? null, candidate: b[file] ?? null, kind: file.endsWith('.map') ? 'sourcemap' : 'artifact' }))
}

/** 公开原始运行可重算身份、顺序、产物对齐与全部数值，不读取运行主机。 */
function inspectReport(report: CollectionReport, batch: Run['batch'], pairs: number, selection: string[], inputIdentities: Record<string, string>) {
  const issues: Issue[] = []
  const check = (condition: unknown, reason: string) => {
    if (!condition) {
      issues.push({ reason })
    }
  }
  check(report.contract === 'isolated-artifact-comparison-v1' && report.comparison === 'architecture', 'Unsupported report contract/comparison')
  check(['all', 'build', 'hmr'].includes(report.kind), 'Invalid collection kind')
  check(same(report.variants, variants), 'Variant declarations differ from native off/off')
  check(report.pairs === pairs && Number.isSafeInteger(pairs) && pairs >= 2, 'Invalid pair count')
  check(!report.error && typeof report.completed === 'string' && Date.parse(report.completed) >= Date.parse(report.started), 'Collector failed or lacks completion')
  const expectedOrder: string[] = []
  for (let pair = 0; pair < pairs; pair++) {
    for (const input of INPUTS) {
      for (const kind of ['build', 'hmr']) {
        if (!selection.includes(`${kind}:${input.id}`)) {
          continue
        }
        for (const variant of pair % 2 ? [...variants].reverse() : variants) {
          expectedOrder.push(`${batch}:${kind}:${input.id}:${pair}:${variant.id}`)
        }
      }
    }
  }
  check(same(report.runs.map(entry => `${entry.run.batch}:${entry.run.kind}:${entry.run.input}:${entry.run.pair}:${entry.variant}`), expectedOrder), 'Run order differs from all alternating pairs')
  const persistedInputs = object(report.inputIdentities, 'persisted input identities')
  for (const variant of variants) {
    const inputs = object(persistedInputs[variant.id], `input identities for ${variant.id}`)
    for (const input of INPUTS) {
      check(inputs[input.source] === inputIdentities[input.source], `Frozen input identity differs: ${variant.id}/${input.id}`)
    }
  }
  const aliased: Run[] = []
  const seen = new Set<string>()
  const rawPairs = new Map<string, Map<number, RawPair>>()
  for (const entry of report.runs) {
    const variant = variants.find(variant => variant.id === entry.variant)
    if (!variant || variant.runtime !== entry.runtime || variant.native !== entry.native || entry.run.side !== 'off') {
      issues.push({ reason: 'Invalid wrapper/native identity' })
      continue
    }
    const run = entry.run
    const ownership = `${run.batch}:${run.kind}:${run.input}:${run.pair}:${entry.variant}`
    check(!seen.has(ownership), `Duplicate run ownership: ${ownership}`)
    seen.add(ownership)
    check(run.batch === batch && Number.isSafeInteger(run.pair) && run.pair >= 0 && run.pair < pairs && selection.includes(`${run.kind}:${run.input}`), `Unexpected run ownership: ${ownership}`)
    check(run.marker === `native-${batch}-${run.pair}`, `Marker differs from actual batch: ${ownership}`)
    check(!run.error && run.native?.failures === 0 && run.native?.calls === 0, `Failed run or native enabled: ${ownership}`)
    const input = INPUTS.find(input => input.id === run.input)
    if (input) {
      const expected = expectedSamples(input, run.kind)
      check(run.sourceDigest === inputIdentities[input.source], `Source identity differs: ${ownership}`)
      check(run.samples.length === expected.length && new Set(run.samples.map(sample => sample.id)).size === expected.length && run.samples.every(sample => expected.includes(sample.id)), `Missing, duplicate or unexpected samples: ${ownership}`)
    }
    else {
      check(false, `Unknown input: ${ownership}`)
    }
    aliased.push({ ...run, side: entry.variant === 'baseline-off' ? 'off' : 'on' })
    for (const sample of run.samples) {
      check(isArtifactEvidence(sample.output), `Invalid artifact evidence: ${ownership}/${sample.id}`)
      for (const [metric, property] of [['wall', 'wallMs'], ['rss', 'rssBytes']] as const) {
        const id = `${sample.id}:${metric}`
        if (!rawPairs.has(id)) {
          rawPairs.set(id, new Map())
        }
        const pairsByIndex = rawPairs.get(id)!
        if (!pairsByIndex.has(run.pair)) {
          pairsByIndex.set(run.pair, { pair: run.pair })
        }
        const pair = pairsByIndex.get(run.pair)!
        const side = entry.variant === 'baseline-off' ? 'baseline' : 'current'
        if (side in pair) {
          pair.duplicate = true
        }
        pair[side] = sample[property]
      }
    }
  }
  check(seen.size === selection.length * pairs * 2, 'Missing or extra runs')
  const parity = []
  for (const scope of selection) {
    for (let pair = 0; pair < pairs; pair++) {
      const [kind, input] = scope.split(':')
      const found = report.runs.filter(entry => entry.run.kind === kind && entry.run.input === input && entry.run.pair === pair)
      const baseline = found.find(entry => entry.variant === 'baseline-off')?.run
      const candidate = found.find(entry => entry.variant === 'candidate-off')?.run
      if (!baseline || !candidate || found.length !== 2) {
        continue
      }
      for (const a of baseline.samples) {
        const b = candidate.samples.find(sample => sample.id === a.id)
        if (!b) {
          continue
        }
        const differences = fileDifferences(a.output.files ?? {}, b.output.files ?? {})
        if (a.inputDigest !== b.inputDigest || a.output.digest !== b.output.digest || a.output.maps !== b.output.maps || !same(a.warnings, b.warnings) || differences.length) {
          parity.push({ batch, pair, sample: a.id, inputEqual: a.inputDigest === b.inputDigest, mapsEqual: a.output.maps === b.output.maps, warningsEqual: same(a.warnings, b.warnings), baselineWarnings: a.warnings, candidateWarnings: b.warnings, differences })
        }
      }
    }
  }
  const statistics = [...rawPairs].map(([id, pairsByIndex]) => {
    const raw = [...pairsByIndex.values()].sort((a, b) => a.pair - b.pair)
    const valid = raw.filter((pair): pair is RawPair & TimingPair => !pair.duplicate && typeof pair.baseline === 'number' && Number.isFinite(pair.baseline) && pair.baseline > 0 && typeof pair.current === 'number' && Number.isFinite(pair.current) && pair.current > 0)
    const summary = summarizePairs(valid)
    return { id, unit: id.endsWith(':rss') ? 'bytes' : 'ms', raw, summary, p95ChangePercent: percent(summary.baselineP95Ms, summary.currentP95Ms), acceptedEvidence: false }
  })
  return { aliased, issues, parity, statistics }
}

function withP95(rows: GateScenario[]): GateScenario[] {
  return rows.flatMap((row) => {
    const summary = summarizePairs(row.pairs)
    return [row, { id: `${row.id}:p95`, requiredPairs: 1, pairs: summary.baselineP95Ms !== null && summary.currentP95Ms !== null ? [{ baseline: summary.baselineP95Ms, current: summary.currentP95Ms }] : [], error: row.error ?? (row.pairs.length !== row.requiredPairs ? 'Incomplete P95 evidence' : undefined) }]
  })
}

/** 复算公开配对和原门禁；保留原私有验证失败，但不声称重新验证采样主机。 */
export function replayReports(payload: PortablePayload) {
  assert.equal(payload.contract, 'architecture-portable-evidence-v1')
  assert(['smoke', 'full'].includes(payload.mode))
  assert.equal(payload.provenance.baseline.role, 'earlier-published-artifacts-of-this-pr')
  assert.equal(payload.provenance.baseline.commit, BASELINE_COMMIT)
  assert.equal(payload.provenance.baseline.isMain, false)
  const evaluation = payload.evaluation as unknown as Evaluation
  assert.equal(evaluation.contract, 'isolated-architecture-evaluation-v1')
  assert.equal(evaluation.identity.baselineCommit, BASELINE_COMMIT)
  assert(Array.isArray(evaluation.issues) && Array.isArray(evaluation.parity), 'Original failure evidence is required')
  const { primary: report, confirmation: confirmationReport } = payload.reports
  assert.equal(report.identitySha256, evaluation.identity.sha256, 'Report source identity differs')
  assert.match(evaluation.identity.sha256, /^[a-f\d]{64}$/)
  for (const input of INPUTS) {
    assert.match(evaluation.identity.inputIdentities[input.source]!, /^[a-f\d]{64}$/)
  }
  const formal = payload.mode === 'full'
  assert.equal(formal, payload.registration !== null, 'Formal mode and preregistration disagree')
  assert.deepEqual(evaluation.preregistration, payload.registration)
  const pairs = formal ? 40 : report.pairs
  const scope = primaryScope.filter(scope => report.kind === 'all' || scope.startsWith(`${report.kind}:`))
  const primary = inspectReport(report, 'primary', pairs, scope, evaluation.identity.inputIdentities)
  const options: Options = { root: '.', output: '.', nativePath: '', mode: payload.mode, runtime: 'classic', buildPairs: pairs, hmrPairs: pairs, inputIdentities: evaluation.identity.inputIdentities }
  const primaryRows = pairRuns(primary.aliased, options, 'primary', scope)
  const publicIssues = [...primary.issues]
  const check = (condition: unknown, reason: string) => {
    if (!condition) {
      publicIssues.push({ reason })
    }
  }
  const requiredConfirmation = formal ? confirmationInputs(primaryRows) : []
  let confirmation: ReturnType<typeof inspectReport> | undefined
  let confirmationRows: GateScenario[] = []
  if (formal) {
    const registration = payload.registration!
    check(registration.contract === 'architecture-performance-preregistered-v1' && registration.comparison === 'architecture', 'Invalid preregistration contract')
    check(report.kind === 'all' && report.mode === 'full' && report.batch === 'primary' && same(report.selection, primaryScope), 'Primary formal scope or batch differs')
    check(same(registration.primaryScope, primaryScope) && registration.primaryPairs === 40, 'Preregistered scope or pair count differs')
    check(same(registration.target, { id: TARGET, statistic: 'P50', changePercentAtMost: -10 }), 'Preregistered target differs')
    check(same(registration.regression, { metrics: ['wall', 'rss'], statistics: ['P50', 'P95'], changePercentAtMost: 5 }), 'Preregistered regression threshold differs')
    check(registration.identitySha256 === evaluation.identity.sha256 && same(registration.inputIdentities, evaluation.identity.inputIdentities), 'Preregistered identity differs')
    const registeredConfirmation = object(registration.confirmation, 'confirmation registration')
    check(registeredConfirmation.pairs === 40 && registeredConfirmation.maxBatches === 1 && registeredConfirmation.conflictingBatches === 'unstable in either direction', 'Confirmation policy differs')
    check(typeof registration.created === 'string' && Date.parse(registration.created) <= Date.parse(report.started), 'Preregistration follows primary start')
    if (confirmationReport) {
      confirmation = inspectReport(confirmationReport, 'confirmation', 40, requiredConfirmation, evaluation.identity.inputIdentities)
      publicIssues.push(...confirmation.issues)
      check(requiredConfirmation.length > 0, 'Unexpected confirmation report')
      check(confirmationReport.identitySha256 === evaluation.identity.sha256, 'Confirmation source identity differs')
      check(confirmationReport.mode === 'full' && confirmationReport.batch === 'confirmation' && same([...(confirmationReport.selection ?? [])].sort(), [...requiredConfirmation].sort()), 'Confirmation selection or mode differs')
      check(Date.parse(confirmationReport.started) >= Date.parse(report.completed ?? ''), 'Confirmation precedes primary completion')
      confirmationRows = pairRuns([...primary.aliased, ...confirmation.aliased], options, 'confirmation', requiredConfirmation)
    }
  }
  else {
    check(confirmationReport === null, 'Smoke must not acquire formal confirmation')
  }
  const regression = formal ? evaluateGate(withP95(primaryRows), withP95(confirmationRows), 5) : null
  if (regression && confirmation) {
    const allConfirmation = withP95(confirmationRows)
    for (const result of regression.scenarios) {
      const row = allConfirmation.find(row => row.id === result.id)
      if (!row) {
        continue
      }
      const summary = summarizePairs(row.pairs)
      result.confirmation = summary
      if (row.error || row.pairs.length !== row.requiredPairs || result.primary.changePercent === null || summary.changePercent === null) {
        result.status = 'incomplete'
        result.error = row.error ?? 'Incomplete confirmation'
      }
      else if (result.primary.changePercent <= 5 && summary.changePercent > 5) {
        result.status = 'unstable'
        result.error = 'Confirmation crosses threshold in the opposite direction'
      }
    }
    regression.status = regression.scenarios.some(row => row.status === 'regression') ? 'regression' : regression.scenarios.some(row => row.status === 'incomplete') ? 'incomplete' : regression.scenarios.some(row => row.status === 'unstable') ? 'unstable' : 'passed'
  }
  const parity = [...primary.parity, ...(confirmation?.parity ?? [])]
  const complete = evaluation.issues.length === 0 && publicIssues.length === 0 && primary.parity.length === 0 && primaryRows.every(row => !row.error && row.pairs.length === row.requiredPairs) && (!confirmation || confirmation.parity.length === 0)
  const targetRow = primaryRows.find(row => row.id === TARGET)
  const observed = targetRow ? summarizePairs(targetRow.pairs) : null
  const met = formal && complete && !targetRow?.error && observed?.count === 40 && observed.changePercent !== null && observed.changePercent <= -10
  const status = !complete ? 'incomplete' : !formal ? 'smoke-valid' : !regression ? 'incomplete' : regression.status !== 'passed' ? regression.status : met ? 'passed' : 'target-not-met'
  const metrics = primaryRows.map(row => ({ id: row.id, requiredPairs: row.requiredPairs, acceptedPairs: row.pairs.length, evidenceStatus: !row.error && row.pairs.length === row.requiredPairs ? 'complete' : 'incomplete', error: row.error ?? null, summary: summarizePairs(row.pairs) }))
  const rawStatistics = { primary: primary.statistics, confirmation: confirmation?.statistics ?? [] }
  const target = { id: TARGET, requiredChangePercent: -10, met, observed }
  for (const [field, recomputed] of Object.entries({ metrics, rawStatistics, target, requiredConfirmation, regression, status, parity })) {
    assert.deepEqual(recomputed, payload.evaluation[field], `Public replay differs from original evaluation: ${field}`)
  }
  assert.equal(evaluation.formalAcceptance, formal ? 'evaluated' : 'not-run')
  assert.equal(evaluation.performanceConclusion, formal ? status : 'not-evaluated: smoke evidence only')
  return {
    replay: 'passed',
    performanceStatus: status,
    mode: payload.mode,
    baseline: payload.provenance.baseline,
    counts: { primaryRuns: report.runs.length, primarySamples: report.runs.reduce((sum, entry) => sum + entry.run.samples.length, 0), confirmationRuns: confirmationReport?.runs.length ?? 0, confirmationSamples: confirmationReport?.runs.reduce((sum, entry) => sum + entry.run.samples.length, 0) ?? 0 },
    metrics,
    rawStatistics,
    target,
    requiredConfirmation,
    regression,
    parity,
    preservedOriginalIssues: evaluation.issues,
    publicIssues,
    limitations: ['This replay recalculates public pairs and gates. It preserves original private validation issues; it does not rerun builds, HMR, runtime hosts, dependency isolation or cache lifecycle.', 'Original byte hashes are commitments to private originals. Public byte hashes validate the separately transformed files and are not substitutes for original hashes.'],
  }
}

/** 字节与来源校验完成后，再独立复算统计与门禁。 */
export async function replayDirectory(directory: string) {
  const { payload, artifacts, readArtifactJson, publicFiles, originalCommitments } = await readPublicEvidence(directory)
  const provenance = await replayProvenance(payload, artifacts, readArtifactJson)
  const retained = await replayRetainedEvidence(payload, artifacts, readArtifactJson)
  return { publicFiles, originalCommitments, provenance, retained, ...replayReports(payload) }
}

async function main() {
  assert(process.argv.length <= 3, 'Usage: replay.mts [public-evidence-directory]')
  const result = await replayDirectory(process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
  process.stdout.write(`${JSON.stringify({ replay: result.replay, performanceStatus: result.performanceStatus, mode: result.mode, counts: result.counts, metrics: result.metrics.length, originalIssues: result.preservedOriginalIssues.length, publicFiles: result.publicFiles, originalCommitments: result.originalCommitments }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`)
    process.exitCode = 1
  })
}
