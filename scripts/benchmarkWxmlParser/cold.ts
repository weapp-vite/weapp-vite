import type { Arm, Fixture, MeasurementError, Operation, Sample } from './types'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { exec } from 'tinyexec'
import { repositoryRoot } from './freeze'
import { cohorts, percentile, summarize } from './measurement'
import { RAW_XML_PARSE_OPTIONS } from './parserContract'
import { assertNodeStackBudget, NODE_STACK_ARGUMENT, STACK_SIZE_KB } from './runtime'

interface ColdMeasurement {
  durationMs: number
  importMs: number
  memoryBefore: Record<string, number>
  memoryAfter: Record<string, number>
  peakRssBytes: number
  execArgv: string[]
}

export async function measureCold(
  entries: Record<Arm, string>,
  fixtures: Fixture[],
  output: string,
  quick: boolean,
  checkpoint: (report: unknown) => Promise<void>,
) {
  const samples: Array<Sample & ColdMeasurement> = []
  const summaries: ReturnType<typeof summarize>[] = []
  const loading: Array<{ cohort: string, arm: Arm, importP50Ms: number, importP95Ms: number, peakRssP50Bytes: number, peakRssP95Bytes: number }> = []
  const errors: MeasurementError[] = []
  const rounds = quick ? 1 : 40
  const operation: Operation = { id: 'cold-first-parse', comparable: false, run: () => undefined }
  const report = {
    boundary: 'Fresh Node process per arm and cell. Imports and first complete corpus pass are measured separately; no warmup, forced GC or OS-cache clearing. Peak RSS includes module loading and corpus.',
    samples,
    summaries,
    loading,
    errors,
    runtime: { stackSizeKb: STACK_SIZE_KB, nodeArgs: [NODE_STACK_ARGUMENT] },
    baselineParseOptions: RAW_XML_PARSE_OPTIONS,
  }
  for (const [cohort, files] of cohorts(fixtures)) {
    const requests: Partial<Record<Arm, string>> = {}
    for (const arm of ['baseline', 'candidate'] as const) {
      const filename = path.join(output, `cold-${cohort}-${arm}.json`)
      await writeFile(filename, JSON.stringify({ entry: entries[arm], fixtures: files, arm, baselineParseOptions: RAW_XML_PARSE_OPTIONS }))
      requests[arm] = filename
    }
    const collect = async (phase: Sample['phase']) => {
      for (let round = 0; round < rounds; round++) {
        const order: Arm[] = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
        for (const arm of order) {
          let fixture = '<worker>'
          try {
            const { stdout } = await exec(process.execPath, [NODE_STACK_ARGUMENT, path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/coldWorker.mjs'), requests[arm]!], { timeout: 60_000, throwOnError: true })
            const measured = JSON.parse(stdout) as ColdMeasurement & { error?: string, fixture?: string }
            assertNodeStackBudget(measured.execArgv)
            if (measured.error) {
              fixture = measured.fixture ?? fixture
              throw new Error(measured.error)
            }
            if (![measured.durationMs, measured.importMs, measured.peakRssBytes].every(value => Number.isFinite(value) && value >= 0)) {
              throw new Error('Invalid cold worker timing or memory result.')
            }
            samples.push({
              ...measured,
              operation: operation.id,
              cohort,
              round,
              arm,
              phase,
              iterations: 1,
              documents: files.length,
              bytes: files.reduce((total, file) => total + file.bytes, 0),
            })
          }
          catch (error) {
            errors.push({ operation: operation.id, fixture, cohort, arm, phase, round, error: String(error) })
            return false
          }
        }
      }
      return true
    }
    const complete = await collect('primary')
    if (complete && summarize(samples, operation, cohort, rounds).status === 'incomplete') {
      await collect('confirmation')
    }
    summaries.push(summarize(samples, operation, cohort, rounds))
    for (const arm of ['baseline', 'candidate'] as const) {
      const rows = samples.filter(sample => sample.cohort === cohort && sample.arm === arm && sample.phase === 'primary')
      loading.push({
        cohort,
        arm,
        importP50Ms: percentile(rows.map(row => row.importMs), 0.5),
        importP95Ms: percentile(rows.map(row => row.importMs), 0.95),
        peakRssP50Bytes: percentile(rows.map(row => row.peakRssBytes), 0.5),
        peakRssP95Bytes: percentile(rows.map(row => row.peakRssBytes), 0.95),
      })
    }
    await checkpoint(report)
  }
  return report
}
