import type { GateScenario } from '../performanceGate/evaluate'
import type { Input, Options, Run } from './contract'
import { evaluateGate, summarizePairs } from '../performanceGate/evaluate'
import { isArtifactEvidence } from './artifacts'
import { expectedSamples, INPUTS, sideOrder, TARGET } from './contract'
import { validNativeDiagnostic } from './diagnosticObservation'

function sameManifest(off: Run, on: Run, input: Input, kind: Run['kind']) {
  const expected = expectedSamples(input, kind)
  for (const run of [off, on]) {
    if (run.samples.length !== expected.length || new Set(run.samples.map(sample => sample.id)).size !== expected.length
      || run.samples.some(sample => !expected.includes(sample.id))) {
      return false
    }
  }
  return expected.every((id) => {
    const a = off.samples.find(sample => sample.id === id)!
    const b = on.samples.find(sample => sample.id === id)!
    return /^[a-f\d]{64}$/.test(a.inputDigest) && a.inputDigest === b.inputDigest
      && isArtifactEvidence(a.output) && isArtifactEvidence(b.output) && a.output.digest === b.output.digest && a.output.maps === b.output.maps
      && JSON.stringify(a.output.files) === JSON.stringify(b.output.files)
      && JSON.stringify(a.warnings) === JSON.stringify(b.warnings)
  })
}

/** 从原始配对重算完整性；任何缺失、重复、顺序漂移与输出变化都不能记作改善。 */
export function pairRuns(runs: Run[], options: Options, batch: Run['batch'], selected?: string[]): GateScenario[] {
  const rows: GateScenario[] = []
  const batchRuns = runs.filter(run => run.batch === batch)
  const expectedOwnership = new Set<string>()
  for (const input of INPUTS) {
    for (const kind of ['build', 'hmr'] as const) {
      if ((kind === 'build' && !input.build) || (selected && !selected.includes(`${kind}:${input.id}`))) {
        continue
      }
      const requiredPairs = kind === 'build' ? options.buildPairs : options.hmrPairs
      const related = runs.filter(run => run.input === input.id)
      const inputDigests = related.map(run => run.inputDigest)
      const initialDigest = options.inputIdentities?.[input.source]
      const frozenInput = Boolean(initialDigest) && related.every(run => run.sourceDigest === initialDigest)
        && inputDigests.length > 0 && inputDigests.every(digest => typeof digest === 'string' && /^[a-f\d]{64}$/.test(digest)) && new Set(inputDigests).size === 1
      const metrics = expectedSamples(input, kind).flatMap(id => ['wall', 'rss'].map(metric => `${id}:${metric}`))
      const scenarios = metrics.map(id => ({ id, requiredPairs, pairs: [] } as GateScenario))
      for (let pair = 0; pair < requiredPairs; pair++) {
        for (const side of ['off', 'on']) {
          expectedOwnership.add(`${kind}:${input.id}:${pair}:${side}`)
        }
        const found = batchRuns.filter(run => run.input === input.id && run.kind === kind && run.pair === pair)
        const off = found.find(run => run.side === 'off')
        const on = found.find(run => run.side === 'on')
        const invalid = !frozenInput || found.length !== 2 || found.map(run => run.side).join(',') !== sideOrder(pair).join(',')
          || !off || !on || off.error || on.error || off.marker !== `native-${batch}-${pair}` || off.marker !== on.marker
          || off.native.failures > 0 || on.native.failures > 0
          || !sameManifest(off, on, input, kind)
        for (const row of scenarios) {
          if (invalid) {
            row.error = 'Missing, duplicate, failed, reordered or non-equivalent paired evidence'
            continue
          }
          const metric = row.id.endsWith(':rss') ? 'rssBytes' : 'wallMs'
          const id = row.id.slice(0, row.id.lastIndexOf(':'))
          if (metric === 'rssBytes' && kind === 'build' && [off, on].some((run) => {
            const quality = run.samples.find(sample => sample.id === id)!.rssSampling
            return !quality || !Number.isInteger(quality.completedSampleCount) || quality.completedSampleCount <= 0
              || !Number.isInteger(quality.unavailableSampleCount) || quality.unavailableSampleCount < 0 || quality.unavailableSampleCount >= quality.completedSampleCount
              || quality.status !== (quality.unavailableSampleCount ? 'partial' : 'available')
          })) {
            row.error = 'Incomplete process-tree RSS sampling evidence'
            continue
          }
          const a = off.samples.find(sample => sample.id === id)![metric]
          const b = on.samples.find(sample => sample.id === id)![metric]
          if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
            row.error = `Missing or invalid ${metric}`
            continue
          }
          row.pairs.push({ baseline: a, current: b })
        }
      }
      rows.push(...scenarios)
    }
  }
  if (batchRuns.some(run => !expectedOwnership.has(`${run.kind}:${run.input}:${run.pair}:${run.side}`))) {
    rows.forEach(row => row.error = 'Unexpected sample ownership')
  }
  return rows
}

function withP95(rows: GateScenario[]) {
  return rows.flatMap((row) => {
    const summary = summarizePairs(row.pairs)
    return [row, {
      id: `${row.id}:p95`,
      requiredPairs: 1,
      pairs: summary.baselineP95Ms !== null && summary.currentP95Ms !== null ? [{ baseline: summary.baselineP95Ms, current: summary.currentP95Ms }] : [],
      error: row.error ?? (row.pairs.length !== row.requiredPairs ? 'Incomplete P95 sample set' : undefined),
    }]
  })
}

/** 确认按完整输入类别执行，保留 HMR 前置场景；仅执行一次等量确认。 */
export function confirmationInputs(primary: GateScenario[]) {
  return [...new Set(withP95(primary).filter(row => !row.error && summarizePairs(row.pairs).changePercent! > 5).map(row => row.id.split(':').slice(0, 2).join(':')))]
}

export function evaluateRuns(runs: Run[], options: Options, selected: string[] = [], diagnostics: Run[] = []) {
  const primary = pairRuns(runs, options, 'primary')
  const confirmation = selected.length ? pairRuns(runs, options, 'confirmation', selected) : []
  const expectedConfirmation = options.mode === 'full' ? confirmationInputs(primary) : []
  if (new Set(selected).size !== selected.length || JSON.stringify([...selected].sort()) !== JSON.stringify([...expectedConfirmation].sort())
    || runs.some(run => !['primary', 'confirmation'].includes(run.batch) || (run.batch === 'confirmation' && !selected.includes(`${run.kind}:${run.input}`)))) {
    primary.forEach(row => row.error = 'Unexpected or missing confirmation plan/evidence')
  }
  const metrics = primary.map(row => ({
    id: row.id,
    requiredPairs: row.requiredPairs,
    summary: summarizePairs(row.pairs),
    evidenceStatus: !row.error && row.pairs.length === row.requiredPairs ? 'complete' as const : 'incomplete' as const,
    error: row.error ?? (row.pairs.length === row.requiredPairs ? undefined : 'Incomplete paired evidence'),
  }))
  const regression = options.mode === 'full' ? evaluateGate(withP95(primary), withP95(confirmation), 5) : null
  const target = primary.find(row => row.id === TARGET)
  const summary = target ? summarizePairs(target.pairs) : undefined
  const targetMet = Boolean(target && !target.error && target.pairs.length === options.buildPairs && summary?.changePercent !== null && summary?.changePercent !== undefined && summary.changePercent <= -10)
  const nativeCalls = diagnostics.reduce((sum, run) => sum + run.native.calls, 0)
  const expectedDiagnostics = INPUTS.filter(input => input.build)
  const diagnosticsValid = diagnostics.length === expectedDiagnostics.length
    && expectedDiagnostics.every(input => diagnostics.filter(run => run.input === input.id && run.kind === 'build' && run.side === 'on' && validNativeDiagnostic(run)
      && runs.some(measured => measured.batch === 'primary' && measured.pair === 0 && measured.kind === 'build' && measured.input === run.input && measured.side === 'on' && sameManifest(run, measured, input, 'build'))).length === 1)
  const valid = regression?.status === 'passed' && nativeCalls > 0 && diagnosticsValid
  const smokeValid = nativeCalls > 0 && diagnosticsValid && metrics.every(row => row.evidenceStatus === 'complete')
  return {
    status: options.mode === 'smoke' ? smokeValid ? 'smoke-passed' : 'incomplete' : !valid ? regression?.status === 'passed' ? 'incomplete' : regression?.status ?? 'incomplete' : targetMet ? 'passed' : 'target-not-met',
    regressionGate: options.mode === 'full' ? 'evaluated' : 'not-run',
    fullAcceptance: options.mode === 'full' ? 'evaluated' : 'not-run',
    target: { id: TARGET, requiredChangePercent: -10, met: options.mode === 'full' && targetMet, observed: summary },
    nativeCalls,
    metrics,
    regression,
  }
}
