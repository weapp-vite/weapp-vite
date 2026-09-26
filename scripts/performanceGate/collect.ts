/* eslint-disable e18e/ban-dependencies -- 基准串行启动两个 checkout 的进程。 */
import type { PeakRssSamplingStats } from '../benchmarkTemplatesPerformance/peakRssSampler'
import type { HmrReport } from './hmrSamples'
import type { OutputEvidence } from './outputEvidence'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { execa } from 'execa'
import { parseCliBuildMs } from '../benchmarkTemplatesPerformance/cliTiming'
import { createPeakRssSampler } from '../benchmarkTemplatesPerformance/peakRssSampler'
import { sampleProcessTreeRssBytes } from '../benchmarkTemplatesPerformance/processTreeRss'
import { readHmrSamples } from './hmrSamples'
import { captureOutputEvidence } from './outputEvidence'

export interface Checkout {
  id: 'baseline' | 'optimized'
  cwd: string
  commit: string
  packageManager?: string
  lockfileSha256?: string
  templates: Array<{ id: string, packageName: string, root: string }>
}
export interface AuditSample {
  id: string
  ms: number
  phase: string
  template: string
  cliMs?: number | null
  rssBytes?: number | null
  heapBytes?: number
  rssSampling?: PeakRssSamplingStats
  profile?: Record<string, number>
  profileStatus?: string
  output?: OutputEvidence
}

/** 两侧先完成相同准备，准备和依赖构建不进入性能采样。 */
export async function prepareCheckouts(driverRoot: string, reportDir: string): Promise<{ baseline: Checkout, optimized: Checkout }> {
  const prepareDir = path.join(reportDir, 'preparation')
  if (process.env.TEMPLATES_PERF_SKIP_PREPARE !== '1') {
    await execa(process.execPath, ['--import', 'tsx', 'scripts/compare-templates-performance.ts'], {
      cwd: driverRoot,
      stdio: 'inherit',
      env: { TEMPLATES_PERF_PREPARE_ONLY: '1', TEMPLATES_PERF_REPORT_DIR: prepareDir },
    })
  }
  const data = JSON.parse(await readFile(path.join(prepareDir, 'prepared.json'), 'utf8')) as { baseline: Checkout, optimized: Checkout }
  for (const side of [data.baseline, data.optimized]) {
    const sha = (await execa('git', ['rev-parse', 'HEAD'], { cwd: side.cwd })).stdout.trim()
    if (sha !== side.commit || !side.templates.length) {
      throw new Error('Prepared checkout SHA or template manifest changed')
    }
  }
  if (data.baseline.templates.map(item => item.id).join(',') !== data.optimized.templates.map(item => item.id).join(',')) {
    throw new Error('Baseline/head template sets differ')
  }
  return data
}

/** 首次构建清理产物，随后重复构建复用该项目状态；两次均单独启动相同 CLI。 */
export async function collectBuilds(checkout: Checkout, logDir: string): Promise<AuditSample[]> {
  const samples: AuditSample[] = []
  await mkdir(logDir, { recursive: true })
  for (const template of checkout.templates) {
    for (const directory of ['dist', 'dist-lib', 'dist-plugin']) {
      await rm(path.join(template.root, directory), { recursive: true, force: true })
    }
    for (const phase of ['first', 'repeat']) {
      console.log(`[performance-build] ${checkout.id} ${template.id} ${phase}`)
      const start = performance.now()
      const child = execa('pnpm', ['--filter', template.packageName, 'build'], { cwd: checkout.cwd, reject: false })
      const sampler = createPeakRssSampler(() => child.pid ? sampleProcessTreeRssBytes(child.pid) : Promise.resolve(null))
      const result = await child
      const ms = performance.now() - start
      const memory = await sampler.stop()
      await writeFile(path.join(logDir, `${template.id}-${phase}.log`), `${result.stdout}\n${result.stderr}`.replaceAll(checkout.cwd, '<checkout>'))
      if (result.exitCode !== 0) {
        throw new Error(`${checkout.id} ${template.id} build failed (${result.exitCode})`)
      }
      const output = await captureOutputEvidence(template.root)
      samples.push({ id: `build:${template.id}:${phase}`, template: template.id, phase, ms, cliMs: parseCliBuildMs(`${result.stdout}\n${result.stderr}`), rssBytes: memory.rssPeakBytes, rssSampling: memory.rssSampling, output })
    }
  }
  return samples
}

/** 每对使用独立 dev 会话，分别记录首次编辑、连续编辑和恢复，禁止取较快阶段。 */
export async function collectHmr(checkout: Checkout, driverRoot: string, logDir: string, runtime: string): Promise<AuditSample[]> {
  await mkdir(logDir, { recursive: true })
  const child = execa(process.execPath, ['--import', 'tsx', 'scripts/benchmark-templates-hmr.ts'], {
    cwd: driverRoot,
    reject: false,
    all: true,
    env: {
      TEMPLATES_HMR_REPO_ROOT: checkout.cwd,
      TEMPLATES_HMR_CLI_PATH: path.join(checkout.cwd, 'packages/weapp-vite/bin/weapp-vite.js'),
      TEMPLATES_HMR_REPORT_DIR: logDir,
      TEMPLATES_HMR_ITERATIONS: '2',
      TEMPLATES_HMR_RUNTIME: runtime,
      TEMPLATES_HMR_SAMPLE_MODE: 'edit-only',
      TEMPLATES_HMR_FILTER: checkout.templates.map(item => item.id).join(','),
      TEMPLATES_HMR_MAX_SCENARIOS_PER_TEMPLATE: process.env.TEMPLATES_PERF_HMR_MAX_SCENARIOS_PER_TEMPLATE ?? '4',
      TEMPLATES_HMR_STARTUP_TIMEOUT_MS: '120000',
      // 产物/恢复失败由下方完整性检查阻断；既有 500ms 绝对预算另外记录，不改变它。
      TEMPLATES_HMR_FAIL_ON_ERROR: '0',
      TEMPLATES_HMR_STOP_ON_ERROR: process.env.PERFORMANCE_PURPOSE === 'smoke' ? '1' : '0',
    },
  })
  child.all?.on('data', chunk => process.stdout.write(chunk))
  const result = await child
  await writeFile(path.join(logDir, 'runner.log'), `${result.stdout}\n${result.stderr}`.replaceAll(checkout.cwd, '<checkout>').replaceAll(driverRoot, '<driver>'))
  if (result.exitCode !== 0) {
    throw new Error(`${checkout.id} ${runtime} HMR process failed (${result.exitCode})`)
  }
  const report = JSON.parse(await readFile(path.join(logDir, 'report.json'), 'utf8')) as HmrReport
  if (report.templates.length !== checkout.templates.length) {
    throw new Error('Missing HMR templates')
  }
  return readHmrSamples(report, runtime)
}
