import type { Options, Run } from './contract'
import type { evaluateRuns } from './evaluate'
import { CONTRACT } from './contract'

const number = (value: number | null | undefined) => value == null ? '—' : value.toFixed(2)

export function renderReport(options: Options, verdict: ReturnType<typeof evaluateRuns>, diagnostics: Run[]) {
  const lines = [
    '# Native analysis paired benchmark',
    '',
    `- Mode: ${options.mode}; result: ${verdict.status}; formal acceptance: ${verdict.fullAcceptance}.`,
    `- Contract: ${CONTRACT}; build pairs per metric: ${options.buildPairs}; HMR pairs per metric: ${options.hmrPairs}. Legacy 7/20-pair reports cannot satisfy the new full contract.`,
    `- Fixed target: ${verdict.target.id}, P50 wall time at least 10% lower. No target selection after sampling.`,
    '- First build: fresh CLI process and removed project outputs; repeat build: another fresh CLI process retaining outputs. Neither means cold OS file cache or an in-process warm compiler.',
    '- Native invocation diagnostics run separately; their timings and wrapper overhead are excluded from measured pairs.',
    '- Diagnostic CPU is process usage since preload, including worker threads but excluding child processes. GC records main-isolate delivered/pending performance entries since preload, excluding worker isolates and child processes; a final unreported GC event may be missing. Neither is phase CPU or wait time.',
    '- CPU/GC diagnostics cover native-on build lifetimes only; no off/on CPU/GC improvement is inferred. Timed pairs and HMR CPU/GC are not collected. Parse counts are not collected: binding calls and input scripts are not parse counts.',
    '- A diagnostic preload observes both real build-process lifetimes and native channel load/fallback events. Zero-call controls are explicitly not-exercised, never native coverage; the fixed TDesign target must exercise native.',
    '- HMR uses the existing 120ms polling watcher protocol; forced GC and full artifact reads occur after each timed edit/restore and affect the next sample. These are observed edit-to-artifact latencies, not uninstrumented default-watcher latency.',
    '- The off/on comparison includes all existing native analyses; its speed difference cannot be attributed entirely to the new compiler batch-summary reuse.',
    '- Three real templates cover build/script/template/style. Route/component topology uses the existing issue-1134-profile fixture as a separate input.',
    '- Page runtime, headless runtime, real Stable IDE, physical devices and other operating systems: not-run.',
    '- RSS is a sampled process-tree peak for build and a GC snapshot for HMR; these are different metrics. Missing memory evidence is incomplete.',
    '- All output files and external sourcemaps must match after only workspace-path and JSON-key-order normalization. Stateful session metadata is not discarded; non-equivalence fails instead of being hidden.',
    '- Warning comparison covers emitted CLI warning paragraphs; it does not replace compiler diagnostic correctness tests.',
    '- Smoke metrics are diagnostic-only when paired evidence is complete; performance thresholds and confirmation batches are not evaluated in smoke mode.',
    '',
    '| Metric | off P50 | on P50 | off P95 | on P95 | P50 change | Status |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
  ]
  for (const row of verdict.metrics) {
    const value = row.summary
    const status = options.mode === 'smoke'
      ? row.evidenceStatus === 'complete' ? 'diagnostic-only' : 'incomplete'
      : verdict.regression?.scenarios.find(scenario => scenario.id === row.id)?.status ?? 'incomplete'
    lines.push(`| ${row.id} | ${number(value.baselineMedianMs)} | ${number(value.currentMedianMs)} | ${number(value.baselineP95Ms)} | ${number(value.currentP95Ms)} | ${number(value.changePercent)}% | ${status} |`)
  }
  lines.push('', 'Wall metrics use ms; RSS metrics use bytes. Full mode checks both P50 and P95 at 5%; any initial breach gets only one equal-size confirmation, and conflicting batches remain unstable.', '', '| Native diagnostic input | calls | failed calls | observed processes | load failures / fallback | coverage |', '| --- | ---: | ---: | ---: | --- | --- |')
  for (const run of diagnostics) {
    lines.push(`| ${run.input} | ${run.native.calls} | ${run.native.failures} | ${run.native.observation?.completedProcesses ?? 0} | ${run.native.observation?.loadFailures ?? 'unknown'} / ${run.native.observation?.fallbacks ?? 'unknown'} | ${run.error ?? run.native.coverage ?? 'incomplete'} |`)
  }
  lines.push('', '| Build diagnostic input | phase | CPU user ms | CPU system ms | GC count | GC ms | GC status |', '| --- | --- | ---: | ---: | ---: | ---: | --- |')
  for (const run of diagnostics) {
    for (const metrics of run.native.observation?.processMetrics ?? []) {
      lines.push(`| ${run.input} | ${metrics.phase} | ${number(metrics.cpuUserMs)} | ${number(metrics.cpuSystemMs)} | ${metrics.gc.count ?? '—'} | ${number(metrics.gc.durationMs)} | ${metrics.gc.status} |`)
    }
  }
  return `${lines.join('\n')}\n`
}
