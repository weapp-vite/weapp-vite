import type { Buffer } from 'node:buffer'
import type { ReportSource, TimingPlan } from './types'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 使用当前 Node 与参数数组跨平台串行执行独立采样，不依赖 shell。
import { execa } from 'execa'
import { aggregateCompileTimings } from './aggregate'
import { compileTimingPlan, LIMITATIONS } from './types'
import { validateCompileSources } from './validate'

export interface CompileTimingOptions {
  bindingDirectory: string
  output: string
  iterations: number
}

interface CompileInvocation {
  plan: TimingPlan
  binding: string
  output: string
}

type ExecuteCompile = (invocation: CompileInvocation) => Promise<{ exitCode?: number, signal?: string, stdout: string, stderr: string }>
const root = fileURLToPath(new URL('../../../', import.meta.url))
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

async function orchestratorIdentity() {
  const directory = path.join(root, 'scripts/nativeBindingAnalysis/compileTimings')
  const files = ['scripts/nativeBindingAnalysis/compileTimings.ts', ...(await readdir(directory))
    .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map(file => `scripts/nativeBindingAnalysis/compileTimings/${file}`)].sort()
  return Object.fromEntries(await Promise.all(files.map(async file => [file, digest(await readFile(path.join(root, file)))])))
}

const executeCompile: ExecuteCompile = async ({ plan, binding, output }) => {
  const result = await execa(process.execPath, ['--import', 'tsx', 'scripts/nativeBindingAnalysis/compile.ts', `--binding=${binding}`, `--output=${output}`, `--scenario=${plan.scenario}`, `--iterations=${plan.iterations}`], {
    cwd: root,
    env: { WEAPP_VITE_NATIVE: '0' },
    reject: false,
  })
  return { exitCode: result.exitCode, signal: result.signal, stdout: result.stdout, stderr: result.stderr }
}

/** 新建输出目录后逐项执行；失败保留所有来源与日志，只写一次最终 summary，不重跑。 */
export async function collectCompileTimings(options: CompileTimingOptions, execute: ExecuteCompile = executeCompile) {
  const plan = compileTimingPlan(options.iterations)
  const files = (await readdir(options.bindingDirectory, { withFileTypes: true })).filter(file => file.isFile() && file.name.endsWith('.node'))
  if (files.length !== 1) {
    throw new Error('Expected exactly one experimental .node binding in --binding-dir')
  }
  const binding = path.resolve(options.bindingDirectory, files[0]!.name)
  const output = path.resolve(options.output)
  const orchestratorSources = await orchestratorIdentity()
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const sources: ReportSource[] = []
  const runs: Array<{ id: string, exitCode?: number, signal?: string, log: string, reportPresent: boolean }> = []
  const startedAt = new Date().toISOString()
  let active = 'correctness'
  let summary: ReturnType<typeof aggregateCompileTimings> | undefined
  let failure: string | undefined
  const scrub = (value: string) => [output, path.resolve(options.bindingDirectory), root, process.cwd()]
    .reduce((text, prefix) => text.replaceAll(prefix, '<workspace>').replaceAll(prefix.replaceAll('\\', '/'), '<workspace>'), value)
  try {
    for (const entry of plan) {
      active = entry.id
      console.log(`[compile-timings] ${entry.id}`)
      const result = await execute({ plan: entry, binding, output: path.join(output, entry.id) })
      const run = { id: entry.id, exitCode: result.exitCode, signal: result.signal, log: `${entry.id}.log`, reportPresent: false }
      runs.push(run)
      await writeFile(path.join(output, run.log), scrub(`${result.stdout}\n${result.stderr}`), { flag: 'wx' })
      const reportPath = `${entry.id}/report.json`
      let raw: Buffer | undefined
      try {
        raw = await readFile(path.join(output, reportPath))
        run.reportPresent = true
      }
      catch {
        throw new Error(`${entry.id}: compiler report is missing or unreadable`)
      }
      const source: ReportSource = { id: entry.id, reportPath, sha256: digest(raw), report: undefined }
      sources.push(source)
      try {
        source.report = JSON.parse(raw.toString()) as unknown
      }
      catch {
        throw new Error(`${entry.id}: compiler report is not valid JSON`)
      }
      if (result.exitCode !== 0 || result.signal) {
        throw new Error(`${entry.id}: compiler subprocess did not exit successfully`)
      }
      validateCompileSources(sources, options.iterations, false)
    }
    if (JSON.stringify(orchestratorSources) !== JSON.stringify(await orchestratorIdentity())) {
      throw new Error('Sampling orchestrator source identity changed during collection')
    }
    summary = aggregateCompileTimings(sources, options.iterations)
  }
  catch (error) {
    failure = scrub(error instanceof Error ? error.message : 'Compiler collection failed')
  }
  const result = {
    ...(summary ?? {
      schemaVersion: 1,
      scope: 'Rejected complete-compiler experiment; retained reports are diagnostic only and are not accepted timing evidence.',
      passed: false,
      productionAcceptance: 'not-evaluated',
      protocol: plan,
      sources: sources.map(({ report: _report, ...source }) => source),
      limitations: LIMITATIONS,
    }),
    collection: { startedAt, finishedAt: new Date().toISOString(), orchestratorSources, runs },
    failedRun: failure ? active : undefined,
    failure,
  }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
  return result
}
