import type { TimingSource } from './types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 Node 与参数数组跨平台串行启动，不依赖 shell 或命令后缀。
import { execa } from 'execa'
import { sanitizeScriptDiagnostic } from '../diagnostics'
import { scriptDigest, scriptRepository, scriptSourceIdentity } from '../identity'
import { scriptScenarios } from '../scenarios'
import { aggregateScriptTimings } from './aggregate'
import { verifyScriptCorrectness } from './correctness'
import { TIMING_LIMITATIONS, timingPlan } from './types'
import { validateTimingSources } from './validate'

interface Invocation { id: string, arguments: string[], output: string }
type Execute = (invocation: Invocation) => Promise<{ exitCode?: number, signal?: string, stdout: string, stderr: string }>

const execute: Execute = async (invocation) => {
  const result = await execa(process.execPath, ['--import', 'tsx', ...invocation.arguments, `--output=${invocation.output}`], {
    cwd: scriptRepository,
    env: { WEAPP_VITE_NATIVE: '0' },
    reject: false,
  })
  return { exitCode: result.exitCode, signal: result.signal, stdout: result.stdout, stderr: result.stderr }
}

/** 先验证三十二场景，再按固定两批计划串行采集；失败保留证据并停止。 */
export async function collectScriptTimings(options: { output: string, iterations: number }, invoke: Execute = execute) {
  const plan = timingPlan(options.iterations)
  const output = path.resolve(options.output)
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const sourceHashes = await scriptSourceIdentity()
  const scenarios = await scriptScenarios()
  const startedAt = new Date().toISOString()
  const sources: TimingSource[] = []
  const runs: Array<{ id: string, exitCode?: number, signal?: string, log: string }> = []
  let active = 'correctness'
  let failure: string | undefined
  let correctnessSha256: string | undefined
  let summary: ReturnType<typeof aggregateScriptTimings> | undefined
  const scrub = (value: unknown) => String(sanitizeScriptDiagnostic(String(value), [output, scriptRepository, process.cwd()]))
  const call = async (id: string, args: string[]) => {
    active = id
    console.log(`[script-timings] ${id}`)
    const invocation = { id, arguments: args, output: path.join(output, id) }
    const result = await invoke(invocation)
    const log = `${id}.log`
    runs.push({ id, exitCode: result.exitCode, signal: result.signal, log })
    await writeFile(path.join(output, log), scrub(`${result.stdout}\n${result.stderr}`), { flag: 'wx' })
    const raw = await readFile(path.join(invocation.output, 'report.json'), 'utf8')
    if (result.exitCode !== 0 || result.signal) {
      throw new Error(`${id}: subprocess failed; report/log preserved`)
    }
    return { raw, report: JSON.parse(raw) as unknown }
  }
  try {
    const correctness = await call('correctness', ['scripts/scriptAnalysisBaseline/check.ts'])
    const oracle = verifyScriptCorrectness(correctness.report, scenarios, sourceHashes)
    correctnessSha256 = scriptDigest(correctness.raw)
    for (const entry of plan) {
      const result = await call(entry.id, ['scripts/scriptAnalysisBaseline/timingRun.ts', `--scenario=${entry.scenario}`, `--batch=${entry.batch}`, `--iterations=${entry.iterations}`])
      sources.push({ id: entry.id, sha256: scriptDigest(result.raw), report: result.report })
      const validated = validateTimingSources(sources, options.iterations, false)
      const report = validated.at(-1)!.report
      const expected = oracle.get(entry.scenario)!
      if (!isDeepStrictEqual(report.sourceHashes, sourceHashes) || report.scenario.inputSha256 !== expected.inputSha256
        || report.checks.baseline.outputSha256 !== expected.outputSha256) {
        throw new Error(`${entry.id}: timing input/output or sources differ from full correctness`)
      }
    }
    if (!isDeepStrictEqual(sourceHashes, await scriptSourceIdentity())) {
      throw new Error('Source identity changed during collection')
    }
    summary = aggregateScriptTimings(sources, options.iterations)
  }
  catch (error) {
    failure = scrub(error)
  }
  const result = {
    ...(summary ?? { schemaVersion: 1, passed: false, productionAcceptance: 'not-evaluated', sources: sources.map(({ report: _report, ...source }) => source), limitations: TIMING_LIMITATIONS }),
    scope: 'Seven-way stronger JS baseline measurement; no Rust performance claim.',
    collection: { startedAt, finishedAt: new Date().toISOString(), sourceHashes, correctnessSha256, runs },
    failedRun: failure ? active : undefined,
    failure,
  }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
  return result
}
