/* eslint-disable ts/no-use-before-define */
/* eslint-disable e18e/ban-dependencies -- HMR 基准脚本需要用 execa 串行安装隔离 npm 目标并执行子采样进程。 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

interface BenchmarkCliOptions {
  iterations?: string
  timeoutMs?: string
  heartbeatMs?: string
  filter?: string
  debug: boolean
  keepWorkspaces: boolean
}

interface BenchmarkTarget {
  raw: string
  kind: 'npm' | 'local'
  label: string
  packageSpec?: string
  packageVersion?: string
  localRepoRoot?: string
}

interface SingleBenchmarkReport {
  generatedAt: string
  iterations: number
  timeoutMs: number
  heartbeatMs: number
  projects: ProjectBenchmark[]
}

interface ProjectBenchmark {
  name: string
  source: string
  startupMs?: number
  scenarios: ScenarioBenchmark[]
  averageMs?: number
  maxMs?: number
  error?: string
}

interface ScenarioBenchmark {
  scenario: string
  averageMs?: number
  maxMs?: number
  error?: string
  averageBuildCoreMs?: number
  averageWatchToDirtyMs?: number
  averageTransformMs?: number
  averageWriteMs?: number
  averageEmitMs?: number
}

interface TargetBenchmarkReport {
  target: BenchmarkTarget
  report: SingleBenchmarkReport
  reportJsonPath: string
  reportMdPath: string
}

interface ComparisonReport {
  generatedAt: string
  baseline: string
  candidate: string
  targets: TargetBenchmarkReport[]
  summary: ComparisonSummary
}

interface ComparisonSummary {
  baselineAverageMs: number
  candidateAverageMs: number
  baselineStartupMs: number
  candidateStartupMs: number
  deltaMs: number
  speedupPercent: number
  startupDeltaMs: number
  startupSpeedupPercent: number
  scenarioRows: ScenarioComparisonRow[]
}

interface ScenarioComparisonRow {
  project: string
  scenario: string
  baselineMs: number
  candidateMs: number
  deltaMs: number
  speedupPercent: number
}

interface PreparedTarget {
  target: BenchmarkTarget
  repoRoot: string
  cliPath: string
  reportDir: string
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const defaultReportRoot = path.join(repoRoot, '.tmp/template-hmr-bench')
const defaultWorkspaceRoot = path.join(defaultReportRoot, 'workspaces')
const defaultCompareReportDir = path.join(defaultReportRoot, 'compare')
const benchmarkScriptPath = path.join(repoRoot, 'scripts/benchmark-template-hmr.ts')
const fixtureProjectIds = [
  'e2e-apps/wevu-runtime-e2e',
  'e2e-apps/github-issues',
  'e2e-apps/auto-routes-define-app-json',
]

async function main() {
  const { targets, options } = parseCliArgs(process.argv.slice(2))
  await mkdir(defaultReportRoot, { recursive: true })

  const reports: TargetBenchmarkReport[] = []
  try {
    for (const target of targets) {
      process.stdout.write(`\n[template-hmr:compare] target ${target.label}\n`)
      const prepared = await prepareTarget(target)
      reports.push(await runTargetBenchmark(prepared, options))
    }

    const comparison = createComparisonReport(reports)
    await mkdir(defaultCompareReportDir, { recursive: true })
    const reportJsonPath = path.join(defaultCompareReportDir, 'report.json')
    const reportMdPath = path.join(defaultCompareReportDir, 'report.md')
    await writeFile(reportJsonPath, `${JSON.stringify(toSerializableComparisonReport(comparison), null, 2)}\n`, 'utf8')
    await writeFile(reportMdPath, renderComparisonMarkdown(comparison), 'utf8')
    process.stdout.write(`\n[template-hmr:compare] report.json -> ${reportJsonPath}\n`)
    process.stdout.write(`[template-hmr:compare] report.md -> ${reportMdPath}\n`)
    process.stdout.write(renderConsoleSummary(comparison))
  }
  finally {
    if (!options.keepWorkspaces) {
      await rm(defaultWorkspaceRoot, { recursive: true, force: true }).catch(() => {})
    }
  }
}

export function parseCliArgs(argv: string[]) {
  const positional: string[] = []
  const options: BenchmarkCliOptions = {
    debug: false,
    keepWorkspaces: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--') {
      continue
    }
    if (current === '--debug') {
      options.debug = true
      continue
    }
    if (current === '--keep-workspaces') {
      options.keepWorkspaces = true
      continue
    }
    if (current === '--iterations') {
      options.iterations = readFlagValue(argv, index, current)
      index += 1
      continue
    }
    if (current === '--timeout-ms') {
      options.timeoutMs = readFlagValue(argv, index, current)
      index += 1
      continue
    }
    if (current === '--heartbeat-ms') {
      options.heartbeatMs = readFlagValue(argv, index, current)
      index += 1
      continue
    }
    if (current === '--filter') {
      options.filter = readFlagValue(argv, index, current)
      index += 1
      continue
    }
    if (current.startsWith('--')) {
      throw new Error(`Unknown option: ${current}`)
    }
    positional.push(current)
  }

  if (positional.length !== 2) {
    throw new Error([
      'Usage: pnpm benchmark:hmr -- <baseline> <candidate> [--iterations 3] [--filter project]',
      'Targets default to npm versions, e.g. 6.15.14 6.15.15.',
      'Use local or local:/path/to/repo to benchmark a local checkout.',
    ].join('\n'))
  }

  return {
    options,
    targets: positional.map(parseTarget),
  }
}

export function parseTarget(raw: string): BenchmarkTarget {
  if (raw === 'local' || raw.startsWith('local:')) {
    const localRepoRoot = raw === 'local'
      ? repoRoot
      : path.resolve(raw.slice('local:'.length))
    return {
      raw,
      kind: 'local',
      label: raw === 'local' ? 'local' : `local:${path.basename(localRepoRoot)}`,
      localRepoRoot,
    }
  }

  const spec = raw.startsWith('npm:') ? raw.slice('npm:'.length) : raw
  const packageSpec = spec.startsWith('weapp-vite@') ? spec : `weapp-vite@${spec}`
  const packageVersion = packageSpec.slice('weapp-vite@'.length)
  return {
    raw,
    kind: 'npm',
    label: `npm:${packageVersion}`,
    packageSpec,
    packageVersion,
  }
}

function readFlagValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

async function prepareTarget(target: BenchmarkTarget): Promise<PreparedTarget> {
  if (target.kind === 'local') {
    const localRepoRoot = target.localRepoRoot ?? repoRoot
    return {
      target,
      repoRoot: localRepoRoot,
      cliPath: path.join(localRepoRoot, 'packages/weapp-vite/bin/weapp-vite.js'),
      reportDir: path.join(defaultReportRoot, safeFileName(target.label)),
    }
  }

  const workspaceRoot = path.join(defaultWorkspaceRoot, safeFileName(target.label))
  await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {})
  await mkdir(workspaceRoot, { recursive: true })

  for (const fixtureProjectId of fixtureProjectIds) {
    await cp(path.join(repoRoot, fixtureProjectId), path.join(workspaceRoot, fixtureProjectId), {
      recursive: true,
      filter: sourcePath => shouldCopyFixturePath(sourcePath),
    })
  }

  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(createNpmWorkspacePackageJson(target), null, 2)}\n`,
    'utf8',
  )
  await writeFile(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8')

  await installNpmTarget(workspaceRoot)

  return {
    target,
    repoRoot: workspaceRoot,
    cliPath: path.join(workspaceRoot, 'node_modules/weapp-vite/bin/weapp-vite.js'),
    reportDir: path.join(defaultReportRoot, safeFileName(target.label)),
  }
}

function shouldCopyFixturePath(sourcePath: string) {
  const base = path.basename(sourcePath)
  return base !== 'node_modules'
    && base !== 'dist'
    && base !== '.weapp-vite'
}

function createNpmWorkspacePackageJson(target: BenchmarkTarget) {
  if (target.kind !== 'npm' || !target.packageVersion) {
    throw new Error(`Target ${target.raw} is not an npm target`)
  }
  return {
    private: true,
    type: 'module',
    devDependencies: {
      'weapp-vite': target.packageVersion,
      'wevu': target.packageVersion,
    },
  }
}

async function installNpmTarget(workspaceRoot: string) {
  const pnpm = resolvePnpmCommand()
  process.stdout.write(`[template-hmr:compare] installing npm target in ${workspaceRoot}\n`)
  await execa(pnpm.command, [...pnpm.args, 'install', '--ignore-scripts'], {
    cwd: workspaceRoot,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      CI: '1',
    },
  })
}

function resolvePnpmCommand() {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && npmExecPath.includes('pnpm')) {
    return {
      command: process.execPath,
      args: [npmExecPath],
    }
  }
  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: [],
  }
}

async function runTargetBenchmark(prepared: PreparedTarget, options: BenchmarkCliOptions): Promise<TargetBenchmarkReport> {
  await rm(prepared.reportDir, { recursive: true, force: true }).catch(() => {})
  await mkdir(prepared.reportDir, { recursive: true })

  const pnpm = resolvePnpmCommand()
  await execa(pnpm.command, [...pnpm.args, 'exec', 'tsx', benchmarkScriptPath], {
    cwd: repoRoot,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      TEMPLATE_HMR_REPO_ROOT: prepared.repoRoot,
      TEMPLATE_HMR_CLI_PATH: prepared.cliPath,
      TEMPLATE_HMR_REPORT_DIR: prepared.reportDir,
      ...(options.iterations ? { TEMPLATE_HMR_ITERATIONS: options.iterations } : {}),
      ...(options.timeoutMs ? { TEMPLATE_HMR_TIMEOUT_MS: options.timeoutMs } : {}),
      ...(options.heartbeatMs ? { TEMPLATE_HMR_HEARTBEAT_MS: options.heartbeatMs } : {}),
      ...(options.filter ? { TEMPLATE_HMR_FILTER: options.filter } : {}),
      ...(options.debug ? { TEMPLATE_HMR_DEBUG: '1' } : {}),
    },
  })

  const reportJsonPath = path.join(prepared.reportDir, 'report.json')
  const report = JSON.parse(await readFile(reportJsonPath, 'utf8')) as SingleBenchmarkReport
  return {
    target: prepared.target,
    report,
    reportJsonPath,
    reportMdPath: path.join(prepared.reportDir, 'report.md'),
  }
}

export function createComparisonReport(targets: TargetBenchmarkReport[]): ComparisonReport {
  if (targets.length !== 2) {
    throw new Error(`Expected exactly two target reports, got ${targets.length}`)
  }
  const [baseline, candidate] = targets
  return {
    generatedAt: new Date().toISOString(),
    baseline: baseline!.target.label,
    candidate: candidate!.target.label,
    targets,
    summary: createComparisonSummary(baseline!.report, candidate!.report),
  }
}

export function createComparisonSummary(
  baseline: SingleBenchmarkReport,
  candidate: SingleBenchmarkReport,
): ComparisonSummary {
  const baselineStartupMs = average(baseline.projects.map(project => project.startupMs))
  const candidateStartupMs = average(candidate.projects.map(project => project.startupMs))
  const scenarioRows = createScenarioRows(baseline, candidate)
  const baselineAverageMs = average(scenarioRows.map(row => row.baselineMs))
  const candidateAverageMs = average(scenarioRows.map(row => row.candidateMs))

  return {
    baselineAverageMs,
    candidateAverageMs,
    baselineStartupMs,
    candidateStartupMs,
    deltaMs: candidateAverageMs - baselineAverageMs,
    speedupPercent: calculateSpeedupPercent(baselineAverageMs, candidateAverageMs),
    startupDeltaMs: candidateStartupMs - baselineStartupMs,
    startupSpeedupPercent: calculateSpeedupPercent(baselineStartupMs, candidateStartupMs),
    scenarioRows,
  }
}

function createScenarioRows(
  baseline: SingleBenchmarkReport,
  candidate: SingleBenchmarkReport,
) {
  const rows: ScenarioComparisonRow[] = []
  const candidateScenarioMap = new Map<string, ScenarioBenchmark>()
  for (const project of candidate.projects) {
    for (const scenario of project.scenarios) {
      candidateScenarioMap.set(createScenarioKey(project.name, scenario.scenario), scenario)
    }
  }

  for (const project of baseline.projects) {
    for (const baselineScenario of project.scenarios) {
      const candidateScenario = candidateScenarioMap.get(createScenarioKey(project.name, baselineScenario.scenario))
      if (!candidateScenario) {
        continue
      }
      if (!isFiniteNumber(baselineScenario.averageMs) || !isFiniteNumber(candidateScenario.averageMs)) {
        continue
      }
      rows.push({
        project: project.name,
        scenario: baselineScenario.scenario,
        baselineMs: baselineScenario.averageMs,
        candidateMs: candidateScenario.averageMs,
        deltaMs: candidateScenario.averageMs - baselineScenario.averageMs,
        speedupPercent: calculateSpeedupPercent(baselineScenario.averageMs, candidateScenario.averageMs),
      })
    }
  }
  return rows
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function createScenarioKey(project: string, scenario: string) {
  return `${project}\0${scenario}`
}

export function calculateSpeedupPercent(baselineMs: number, candidateMs: number) {
  if (!Number.isFinite(baselineMs) || baselineMs <= 0 || !Number.isFinite(candidateMs)) {
    return 0
  }
  return ((baselineMs - candidateMs) / baselineMs) * 100
}

function toSerializableComparisonReport(report: ComparisonReport) {
  return {
    generatedAt: report.generatedAt,
    baseline: report.baseline,
    candidate: report.candidate,
    summary: report.summary,
    targets: report.targets.map(target => ({
      target: target.target,
      reportJsonPath: formatReportPath(target.reportJsonPath),
      reportMdPath: formatReportPath(target.reportMdPath),
      report: target.report,
    })),
  }
}

function renderComparisonMarkdown(report: ComparisonReport) {
  const lines = [
    '# HMR Benchmark Comparison',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- baseline: ${report.baseline}`,
    `- candidate: ${report.candidate}`,
    '',
    '| metric | baseline | candidate | delta | speedup |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| avg HMR | ${formatMs(report.summary.baselineAverageMs)} | ${formatMs(report.summary.candidateAverageMs)} | ${formatSignedMs(report.summary.deltaMs)} | ${formatPercent(report.summary.speedupPercent)} |`,
    `| startup | ${formatMs(report.summary.baselineStartupMs)} | ${formatMs(report.summary.candidateStartupMs)} | ${formatSignedMs(report.summary.startupDeltaMs)} | ${formatPercent(report.summary.startupSpeedupPercent)} |`,
    '',
    '## Scenarios',
    '',
    '| project | scenario | baseline | candidate | delta | speedup |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
  ]

  for (const row of report.summary.scenarioRows) {
    lines.push(`| ${row.project} | ${row.scenario} | ${formatMs(row.baselineMs)} | ${formatMs(row.candidateMs)} | ${formatSignedMs(row.deltaMs)} | ${formatPercent(row.speedupPercent)} |`)
  }

  lines.push('')
  lines.push('## Source Reports')
  lines.push('')
  for (const target of report.targets) {
    lines.push(`- ${target.target.label}: ${formatReportPath(target.reportMdPath)}`)
  }

  return `${lines.join('\n')}\n`
}

function renderConsoleSummary(report: ComparisonReport) {
  return [
    '',
    `[template-hmr:compare] ${report.candidate} vs ${report.baseline}`,
    `[template-hmr:compare] avg HMR ${formatMs(report.summary.candidateAverageMs)} vs ${formatMs(report.summary.baselineAverageMs)} (${formatPercent(report.summary.speedupPercent)})`,
    '',
  ].join('\n')
}

function average(values: Array<number | undefined>) {
  const filtered = values.filter(value => Number.isFinite(value))
  if (filtered.length === 0) {
    return 0
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function safeFileName(value: string) {
  return value.replaceAll(/[^\w.-]+/g, '-').replaceAll(/^-+|-+$/g, '')
}

function formatMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${value.toFixed(2)} ms`
}

function formatSignedMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} ms`
}

function formatPercent(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatReportPath(value: string) {
  const relative = path.relative(repoRoot, value).replaceAll('\\', '/')
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : value.replaceAll('\\', '/')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
