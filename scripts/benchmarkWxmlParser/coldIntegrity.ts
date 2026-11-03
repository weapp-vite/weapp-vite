import type { runBrowser } from './browser'
import type { measureCold } from './cold'
import type { Fixture, MeasurementResult, Operation, Sample } from './types'
import { isDeepStrictEqual } from 'node:util'
import { BENCHMARK_ORIGIN, ISOLATION_HEADERS } from './browserDocument'
import { cohorts } from './cohorts'
import { RAW_XML_PARSE_OPTIONS } from './parserContract'
import { assertNodeStackBudget, STACK_SIZE_KB } from './runtime'
import { percentile, summarize } from './statistics'

type NodeColdResult = Awaited<ReturnType<typeof measureCold>>
type BrowserColdResult = Awaited<ReturnType<typeof runBrowser>>['cold']
type ColdCells = Pick<MeasurementResult, 'samples' | 'summaries' | 'errors'>
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

function assertColdCells(report: ColdCells, fixtures: Fixture[], quick: boolean, id: string) {
  const groups = cohorts(fixtures)
  const rounds = quick ? 1 : 40
  const operation: Operation = { id, comparable: false, run: () => undefined }
  if (report.errors.length) {
    throw new Error(`Cold operation errors: ${report.errors.length}`)
  }
  if (report.summaries.length !== groups.length || new Set(report.summaries.map(row => row.cohort)).size !== groups.length
    || report.summaries.some(row => row.operation !== id || !groups.some(([cohort]) => cohort === row.cohort))
    || report.samples.some(row => row.operation !== id || !groups.some(([cohort]) => cohort === row.cohort) || !['primary', 'confirmation'].includes(row.phase))) {
    throw new Error('Missing, duplicate or unexpected cold cells.')
  }
  for (const [cohort, files] of groups) {
    const rows = report.samples.filter(row => row.cohort === cohort)
    const primary = rows.filter(row => row.phase === 'primary')
    const confirmation = rows.filter(row => row.phase === 'confirmation')
    const bytes = files.reduce((total, fixture) => total + fixture.bytes, 0)
    const validate = (batch: Sample[]) => {
      if (batch.length !== rounds * 2) {
        throw new Error('Missing or duplicate cold samples.')
      }
      for (let round = 0; round < rounds; round++) {
        const pair = batch.filter(row => row.round === round)
        const order = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
        if (pair.length !== 2 || !isDeepStrictEqual(pair.map(row => row.arm), order)
          || pair.some(row => !finite(row.durationMs) || row.iterations !== 1 || row.documents !== files.length || row.bytes !== bytes)) {
          throw new Error('Invalid cold paired order, timing or workload.')
        }
      }
    }
    validate(primary)
    const first = summarize(primary, operation, cohort, rounds)
    if (first.status === 'incomplete') {
      validate(confirmation)
    }
    else if (confirmation.length) {
      throw new Error('Unexpected additional cold confirmation batch.')
    }
    const summary = summarize(rows, operation, cohort, rounds)
    if (summary.status === 'incomplete' || !isDeepStrictEqual(summary, report.summaries.find(row => row.cohort === cohort))) {
      throw new Error('Incomplete or different cold summary.')
    }
  }
  return groups
}

/** 冷路径保持信息性结论，但必须完整满足外部输入、双方轮次和加载证据计划。 */
export function assertNodeColdIntegrity(report: NodeColdResult, fixtures: Fixture[], quick: boolean) {
  const groups = assertColdCells(report, fixtures, quick, 'cold-first-parse')
  if (report.runtime.stackSizeKb !== STACK_SIZE_KB || !isDeepStrictEqual(report.baselineParseOptions, RAW_XML_PARSE_OPTIONS)) {
    throw new Error('Different cold Node runtime or parse contract.')
  }
  assertNodeStackBudget(report.runtime.nodeArgs)
  for (const sample of report.samples) {
    if (!finite(sample.importMs) || !finite(sample.peakRssBytes)
      || [sample.memoryBefore, sample.memoryAfter].some(value => !value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => !finite(item)))) {
      throw new Error('Invalid cold Node loading or memory sample.')
    }
    assertNodeStackBudget(sample.execArgv)
  }
  if (report.loading.length !== groups.length * 2 || new Set(report.loading.map(row => `${row.cohort}:${row.arm}`)).size !== report.loading.length) {
    throw new Error('Missing or duplicate cold loading cells.')
  }
  for (const [cohort] of groups) {
    for (const arm of ['baseline', 'candidate'] as const) {
      const rows = report.samples.filter(row => row.cohort === cohort && row.arm === arm && row.phase === 'primary')
      const expected = {
        cohort,
        arm,
        importP50Ms: percentile(rows.map(row => row.importMs), 0.5),
        importP95Ms: percentile(rows.map(row => row.importMs), 0.95),
        peakRssP50Bytes: percentile(rows.map(row => row.peakRssBytes), 0.5),
        peakRssP95Bytes: percentile(rows.map(row => row.peakRssBytes), 0.95),
      }
      if (!isDeepStrictEqual(report.loading.find(row => row.cohort === cohort && row.arm === arm), expected)) {
        throw new Error('Missing or different cold loading summary.')
      }
    }
  }
}

/** Chromium 首次调用逐页核对冷样本、时钟和实际隔离文档，不把完整性当作性能门槛。 */
export function assertBrowserColdIntegrity(report: BrowserColdResult, fixtures: Fixture[], quick: boolean) {
  assertColdCells(report, fixtures, quick, 'browser-first-parse')
  for (const { clock, document } of report.samples) {
    if (clock.source !== 'performance.now' || !Number.isInteger(clock.reads) || clock.reads <= 0
      || !Number.isInteger(clock.positiveChanges) || clock.positiveChanges < 0 || clock.positiveChanges > clock.reads
      || !finite(clock.timeOrigin) || clock.crossOriginIsolated !== true || clock.secureContext !== true
      || (clock.positiveChanges === 0
        ? clock.minimumPositiveDeltaMs !== null || clock.maximumPositiveDeltaMs !== null
        : !finite(clock.minimumPositiveDeltaMs) || clock.minimumPositiveDeltaMs <= 0 || !finite(clock.maximumPositiveDeltaMs) || clock.maximumPositiveDeltaMs < clock.minimumPositiveDeltaMs)) {
      throw new Error('Invalid cold Chromium clock sample.')
    }
    if (document.url !== `${BENCHMARK_ORIGIN}/cold` || document.crossOriginIsolated !== true
      || !Object.entries(ISOLATION_HEADERS).every(([name, value]) => document.responseHeaders[name] === value)) {
      throw new Error('Different cold Chromium document or isolation contract.')
    }
  }
}
