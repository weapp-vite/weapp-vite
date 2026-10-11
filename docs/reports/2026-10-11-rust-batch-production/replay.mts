import type { Evidence, Options, Run, Sample } from '../../../scripts/benchmarkNativeAnalysis/contract'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { CONTRACT, INPUTS, TARGET } from '../../../scripts/benchmarkNativeAnalysis/contract'
import { evaluateRuns } from '../../../scripts/benchmarkNativeAnalysis/evaluate'

export interface NativeReport {
  schemaVersion: number
  contract: string
  target: string
  mode: Options['mode']
  runtime: Options['runtime']
  buildPairs: number
  hmrPairs: number
  identity: Record<string, string>
  inputs: unknown
  environment: { finishedAt?: string }
  confirmations: string[]
  runs: Run[]
  diagnostics: Run[]
  verdict: ReturnType<typeof evaluateRuns>
  failure?: string
  [key: string]: unknown
}
export interface ManifestBase { group: string, files: Record<string, string> }
export type OrderToken = number | [number, number]
export interface OutputDelta {
  baseRef: number
  fields: Omit<Evidence, 'files'>
  changed: Record<string, string>
  removed: string[]
  order?: OrderToken[]
}
type CompactSample = Omit<Sample, 'output'> & { outputRef: number }
export type CompactRun = Omit<Run, 'samples'> & { samples: CompactSample[] }
interface CompactReport extends Omit<NativeReport, 'runs' | 'diagnostics'> { runs: CompactRun[], diagnostics: CompactRun[] }
export interface CompactNativeEvidence {
  schema: 'native-analysis-public-lossless-v1'
  sourceReportSha256: string
  sourceReportBytes: number
  codec: string
  counts: Record<string, number>
  bases: ManifestBase[]
  outputs: OutputDelta[]
  report: CompactReport
}

/** 从公开字典恢复完整报告；产物键序也是被保留的证据。 */
export function decodeNativeEvidence(compact: CompactNativeEvidence): NativeReport {
  assert.equal(compact.schema, 'native-analysis-public-lossless-v1')
  const outputs = compact.outputs.map((delta) => {
    assert(Number.isSafeInteger(delta.baseRef) && delta.baseRef >= 0, 'Invalid manifest base reference')
    const base = compact.bases[delta.baseRef]
    assert(base, 'Missing manifest base')
    const removed = new Set(delta.removed)
    const keys = [...Object.keys(base.files).filter(file => !removed.has(file)), ...Object.keys(delta.changed).filter(file => !Object.hasOwn(base.files, file))]
    const indices = delta.order?.flatMap(token => typeof token === 'number' ? [token] : Array.from({ length: token[1] }, (_, index) => token[0] + index))
    if (indices) {
      assert.equal(indices.length, keys.length, 'Manifest order length changed')
      assert.equal(new Set(indices).size, keys.length, 'Manifest order contains duplicate positions')
      assert(indices.every(index => Number.isSafeInteger(index) && index >= 0 && index < keys.length), 'Invalid manifest order index')
    }
    const order = indices ? indices.map(index => keys[index]!) : keys
    const files = Object.fromEntries(order.map(file => [file, Object.hasOwn(delta.changed, file) ? delta.changed[file]! : base.files[file]!]))
    return { ...delta.fields, files }
  })
  const expandRun = (run: CompactRun): Run => ({
    ...run,
    samples: run.samples.map(({ outputRef, ...sample }) => {
      assert(Number.isSafeInteger(outputRef) && outputRef >= 0, 'Invalid output reference')
      const output = outputs[outputRef]
      assert(output, 'Missing outputRef')
      return { ...sample, output }
    }),
  })
  return { ...compact.report, runs: compact.report.runs.map(expandRun), diagnostics: compact.report.diagnostics.map(expandRun) } as NativeReport
}

/** 原选项、冻结输入身份和确认计划驱动纯评估，不启动采样或加载 addon。 */
export function replayNativeEvidence(report: NativeReport) {
  assert.equal(report.schemaVersion, 2)
  assert.equal(report.contract, CONTRACT)
  assert.equal(report.target, TARGET)
  assert.deepStrictEqual(report.inputs, JSON.parse(JSON.stringify(INPUTS)), 'Replay requires the original v2 contract')
  assert(['full', 'smoke'].includes(report.mode), 'Unknown benchmark mode')
  assert(['classic', 'stateful-experimental'].includes(report.runtime), 'Unknown runtime mode')
  assert(Number.isSafeInteger(report.buildPairs) && report.buildPairs >= 2)
  assert(Number.isSafeInteger(report.hmrPairs) && report.hmrPairs >= 2)
  if (report.mode === 'full') {
    assert.equal(report.buildPairs, 40)
    assert.equal(report.hmrPairs, 40)
  }
  const options: Options = {
    root: '.',
    output: '.',
    nativePath: '',
    mode: report.mode,
    runtime: report.runtime,
    buildPairs: report.buildPairs,
    hmrPairs: report.hmrPairs,
    inputIdentities: Object.fromEntries(INPUTS.map(input => [input.source, report.identity[input.source]!])),
  }
  const verdict = evaluateRuns(report.runs, options, report.confirmations, report.diagnostics)
  if (report.failure) {
    verdict.status = 'incomplete'
  }
  return JSON.parse(JSON.stringify(verdict)) as ReturnType<typeof evaluateRuns>
}

async function main() {
  assert(process.argv.length <= 3, 'Usage: replay.mts [native-paired.json]')
  const source = process.argv[2] ?? new URL('./native-paired.json', import.meta.url)
  const evidence = JSON.parse(await readFile(source, 'utf8')) as CompactNativeEvidence
  const report = decodeNativeEvidence(evidence)
  const verdict = replayNativeEvidence(report)
  assert.deepStrictEqual(verdict, report.verdict, 'Public evidence verdict differs from the original report')
  process.stdout.write(`${JSON.stringify({ sourceReportSha256: evidence.sourceReportSha256, runs: report.runs.length, diagnostics: report.diagnostics.length, replay: 'passed', performanceStatus: verdict.status, targetMet: verdict.target.met }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`)
    process.exitCode = 1
  })
}
