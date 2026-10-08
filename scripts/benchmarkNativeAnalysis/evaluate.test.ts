import type { Options, Run } from './contract'
import { describe, expect, it } from 'vitest'
import { sha256 } from './artifacts'
import { expectedSamples, INPUTS, parseOptions, sideOrder, TARGET } from './contract'
import { confirmationInputs, evaluateRuns, pairRuns } from './evaluate'
import { renderReport } from './report'

function fixture(mode = 'smoke', change = 0) {
  const options = parseOptions([`--mode=${mode}`, '--output=result', '--native-path=binding.node'])
  options.inputIdentities = Object.fromEntries(INPUTS.map(input => [input.source, 'a'.repeat(64)]))
  const runs: Run[] = []
  const files = { 'app.js': 'c'.repeat(64), 'app.js.map': 'd'.repeat(64), 'app.json': 'e'.repeat(64) }
  const output = { files, digest: sha256(JSON.stringify(files)), maps: 1 }
  for (const input of INPUTS) {
    for (const kind of ['build', 'hmr'] as const) {
      if (kind === 'build' && !input.build) {
        continue
      }
      const count = kind === 'build' ? options.buildPairs : options.hmrPairs
      for (let pair = 0; pair < count; pair++) {
        for (const side of sideOrder(pair)) {
          runs.push({
            input: input.id,
            kind,
            side,
            pair,
            batch: 'primary',
            marker: `native-primary-${pair}`,
            inputDigest: 'a'.repeat(64),
            sourceDigest: 'a'.repeat(64),
            native: { calls: 0, failures: 0, processes: 0 },
            samples: expectedSamples(input, kind).map(id => ({ id, wallMs: side === 'on' ? 100 + change : 100, rssBytes: 100, rssSampling: { status: 'available', completedSampleCount: 4, unavailableSampleCount: 0 }, inputDigest: 'a'.repeat(64), output: structuredClone(output), warnings: [] })),
          })
        }
      }
    }
  }
  const diagnostics: Run[] = INPUTS.filter(input => input.build).map(input => ({ ...structuredClone(runs.find(run => run.input === input.id && run.side === 'on' && run.kind === 'build')!), native: {
    calls: 1,
    failures: 0,
    processes: 1,
    coverage: 'exercised',
    observation: { processes: 2, completedProcesses: 2, bindingCalls: 1, batchCalls: 0, inputScripts: 1, inputBytes: 12, cacheHits: 0, fallbacks: 0, loadFailures: 0 },
  } }))
  return { options, runs, diagnostics }
}

function confirmation(runs: Run[], selected: string[]) {
  return runs.filter(run => selected.includes(`${run.kind}:${run.input}`)).map(run => ({ ...structuredClone(run), batch: 'confirmation' as const, marker: `native-confirmation-${run.pair}` }))
}

describe('native benchmark gate', () => {
  it('does not apply performance thresholds to two-pair smoke', () => {
    const { options, runs, diagnostics } = fixture('smoke', 50)
    const verdict = evaluateRuns(runs, options, [], diagnostics)
    expect(verdict).toMatchObject({ status: 'smoke-passed', fullAcceptance: 'not-run', regressionGate: 'not-run', regression: null, target: { met: false } })
    expect(verdict.metrics.every(row => row.evidenceStatus === 'complete' && !row.error)).toBe(true)
    const wall = verdict.metrics.find(row => row.id === TARGET)!
    expect(wall.summary).toMatchObject({ count: 2, baselineMedianMs: 100, currentMedianMs: 150, changePercent: 50 })
    expect(renderReport(options, verdict, diagnostics)).toContain(`| ${TARGET} | 100.00 | 150.00 | 100.00 | 150.00 | 50.00% | diagnostic-only |`)
  })

  it('keeps smoke output mismatches incomplete without evaluating a regression', () => {
    const { options, runs, diagnostics } = fixture('smoke', 50)
    runs[0]!.samples[0]!.output.files['app.js.map'] = 'f'.repeat(64)
    const verdict = evaluateRuns(runs, options, [], diagnostics)
    expect(verdict).toMatchObject({ status: 'incomplete', regression: null })
    expect(verdict.metrics.find(row => row.id === 'build:weapp-vite-template:first:wall')).toMatchObject({ evidenceStatus: 'incomplete' })
    const report = renderReport(options, verdict, diagnostics)
    expect(report).toContain('| build:weapp-vite-template:first:wall | 100.00 | 150.00 | 100.00 | 150.00 | 50.00% | incomplete |')
    expect(report).toContain(`| ${TARGET} | 100.00 | 150.00 | 100.00 | 150.00 | 50.00% | diagnostic-only |`)
  })

  it('requires the fixed target instead of selecting a fast scenario later', () => {
    const { options, runs, diagnostics } = fixture('full')
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('target-not-met')
    for (const run of runs) {
      for (const sample of run.samples) {
        if (run.side === 'on' && `${sample.id}:wall` === TARGET) {
          sample.wallMs = 89
        }
      }
    }
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('passed')
  })

  it('allows observed controls without applicable native work but requires the fixed target', () => {
    const { options, runs, diagnostics } = fixture()
    diagnostics[0]!.native.calls = 0
    diagnostics[0]!.native.processes = 0
    diagnostics[0]!.native.coverage = 'not-exercised'
    diagnostics[0]!.native.observation!.bindingCalls = 0
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('smoke-passed')
    diagnostics[2]!.native.calls = 0
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('incomplete')
  })

  it('does not confuse missing preload, load failures or fallback with an unexercised control', () => {
    const { options, runs, diagnostics } = fixture()
    diagnostics[0]!.native.observation!.loadFailures = 1
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('incomplete')
    diagnostics[0]!.native.observation!.loadFailures = 0
    diagnostics[0]!.native.observation!.fallbacks = 1
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('incomplete')
    delete diagnostics[0]!.native.observation
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('incomplete')
  })

  it.each(['missing', 'duplicate', 'output', 'warnings', 'order', 'memory', 'extra-confirmation', 'between-pair-input'])('rejects %s evidence', (kind) => {
    const { options, runs, diagnostics } = fixture()
    if (kind === 'missing') {
      runs.pop()
    }
    if (kind === 'duplicate') {
      runs.push(runs[0]!)
    }
    if (kind === 'output') {
      runs[0]!.samples[0]!.output.digest = 'd'.repeat(64)
    }
    if (kind === 'warnings') {
      runs[0]!.samples[0]!.warnings = ['Warning: different']
    }
    if (kind === 'order') {
      [runs[0], runs[1]] = [runs[1]!, runs[0]!]
    }
    if (kind === 'memory') {
      runs[0]!.samples[0]!.rssBytes = null
    }
    if (kind === 'extra-confirmation') {
      runs.push({ ...runs[0]!, batch: 'confirmation' })
    }
    if (kind === 'between-pair-input') {
      runs[0]!.inputDigest = 'f'.repeat(64)
      runs[1]!.inputDigest = 'f'.repeat(64)
    }
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('incomplete')
  })

  it('retains a regression and marks a conflicting equal-size confirmation unstable', () => {
    const { options, runs, diagnostics } = fixture('full', 10)
    const selected = confirmationInputs(pairRuns(runs, options, 'primary'))
    const repeated = confirmation(runs, selected)
    expect(evaluateRuns([...runs, ...repeated], options, selected, diagnostics).status).toBe('regression')
    repeated.forEach(run => run.samples.forEach(sample => sample.wallMs = 100))
    expect(evaluateRuns([...runs, ...repeated], options, selected, diagnostics).status).toBe('unstable')
    expect(evaluateRuns([...runs, ...repeated, repeated[0]!], options, selected, diagnostics).status).toBe('incomplete')
  })

  it('checks P95 independently and never treats missing observations as zero', () => {
    const { options, runs } = fixture('full')
    const outlier = runs.find(run => run.kind === 'build' && run.side === 'on')!
    outlier.samples[0]!.wallMs = 200
    expect(confirmationInputs(pairRuns(runs, options, 'primary'))).toContain(`build:${outlier.input}`)
    expect(pairRuns([], options as Options, 'primary').every(row => row.error && row.pairs.length === 0)).toBe(true)
  })

  it('retains partial RSS diagnostics because the final probe may race process exit', () => {
    const { options, runs, diagnostics } = fixture('full')
    runs[0]!.samples[0]!.rssSampling = { status: 'partial', completedSampleCount: 10, unavailableSampleCount: 8 }
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('target-not-met')
    runs[0]!.samples[0]!.rssSampling = { status: 'unavailable', completedSampleCount: 10, unavailableSampleCount: 10 }
    expect(evaluateRuns(runs, options, [], diagnostics).status).toBe('incomplete')
  })
})
