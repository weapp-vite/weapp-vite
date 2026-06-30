/* eslint-disable ts/no-use-before-define */

import type { Buffer } from 'node:buffer'

import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

type ReportMode = 'collect' | 'smoke' | 'full'
type SuiteStatus = 'skipped' | 'passed' | 'failed'

interface SuiteResult {
  id: string
  label: string
  status: SuiteStatus
  command?: string
  durationMs?: number
  reportJson?: string
  reportMd?: string
  error?: string
  summary?: Record<string, unknown>
}

interface SuiteConfig {
  id: string
  label: string
  command: string
  args: string[]
  reportDir: string
  defaultEnabled?: boolean
  env: NodeJS.ProcessEnv
  parse: (reportJson: string) => Promise<Record<string, unknown>>
}

interface DistSizeEntry {
  name: string
  relativeDir: string
  bytes: number
  gzipBytes: number
  fileCount: number
}

interface PerformanceReport {
  version: 1
  generatedAt: string
  mode: ReportMode
  commit: string
  reportRoot: string
  baseline?: {
    report: string
    commit: string
    generatedAt: string
  }
  suites: SuiteResult[]
  dist: {
    totalBytes: number
    totalGzipBytes: number
    totalFiles: number
    entries: DistSizeEntry[]
  }
  comparison?: PerformanceComparison
  hotTargets: Array<{
    area: string
    metric: string
    value: number | string
    source: string
  }>
}

interface MetricComparison {
  area: string
  metric: string
  unit: 'bytes' | 'count' | 'ms' | 'ratio' | 'percent'
  current: number
  baseline: number
  delta: number
  deltaPercent?: number
  source: string
}

interface PerformanceComparison {
  dist: MetricComparison[]
  suites: MetricComparison[]
}

const repoRoot = process.cwd()
const mode = readMode(process.env.PERFORMANCE_REPORT_MODE ?? readArgValue('--mode') ?? 'smoke')
const reportRoot = path.resolve(
  process.env.PERFORMANCE_REPORT_DIR
  ?? readArgValue('--report-dir')
  ?? path.join(repoRoot, '.tmp/performance-report', formatTimestamp(new Date())),
)
const reportJsonPath = path.join(reportRoot, 'report.json')
const reportMdPath = path.join(reportRoot, 'report.md')
const baselineReportPath = process.env.PERFORMANCE_REPORT_BASELINE ?? readArgValue('--baseline')
const runFilter = new Set(
  (process.env.PERFORMANCE_REPORT_RUNS ?? readArgValue('--runs') ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
)
const cleanReportDir = process.env.PERFORMANCE_REPORT_CLEAN !== '0'

async function main() {
  if (cleanReportDir) {
    await rm(reportRoot, { recursive: true, force: true })
  }
  await mkdir(reportRoot, { recursive: true })

  const suites: SuiteResult[] = []
  const dist = await collectDistSizes()
  const baselineReport = await readBaselineReport()

  for (const suite of resolveSuites()) {
    if (runFilter.size && !runFilter.has(suite.id)) {
      suites.push({
        id: suite.id,
        label: suite.label,
        status: 'skipped',
        summary: { reason: 'filtered' },
      })
      continue
    }
    if (!runFilter.size && suite.defaultEnabled === false) {
      suites.push({
        id: suite.id,
        label: suite.label,
        status: 'skipped',
        summary: { reason: 'full-only' },
      })
      continue
    }
    suites.push(await runSuite(suite))
  }

  const report: PerformanceReport = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode,
    commit: await readGitCommit(),
    reportRoot: formatReportPath(reportRoot),
    baseline: baselineReport
      ? {
          report: formatReportPath(baselineReport.path),
          commit: baselineReport.report.commit,
          generatedAt: baselineReport.report.generatedAt,
        }
      : undefined,
    suites,
    dist,
    comparison: baselineReport ? compareReports({ suites, dist }, baselineReport.report) : undefined,
    hotTargets: collectHotTargets(suites, dist),
  }

  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(reportMdPath, renderMarkdown(report), 'utf8')
  process.stdout.write(`${renderConsoleSummary(report)}\n`)

  if (suites.some(suite => suite.status === 'failed') && process.env.PERFORMANCE_REPORT_FAIL_ON_ERROR === '1') {
    process.exitCode = 1
  }
}

function resolveSuites() {
  if (mode === 'collect') {
    return []
  }

  const suites: SuiteConfig[] = [
    {
      id: 'hmr-lab',
      label: 'HMR Lab',
      command: 'pnpm',
      args: ['benchmark:hmr:lab'],
      reportDir: path.join(reportRoot, 'hmr-lab'),
      env: {
        HMR_LAB_REPORT_DIR: path.join(reportRoot, 'hmr-lab'),
        HMR_LAB_ITERATIONS: process.env.HMR_LAB_ITERATIONS ?? (mode === 'full' ? '2' : '1'),
        HMR_LAB_FILTER: process.env.HMR_LAB_FILTER ?? (mode === 'full' ? '' : 'sfc'),
      },
      parse: summarizeHmrLabReport,
    },
    {
      id: 'hmr-lab-native',
      label: 'HMR Lab Native',
      command: 'pnpm',
      args: ['benchmark:hmr:lab'],
      reportDir: path.join(reportRoot, 'hmr-lab-native'),
      defaultEnabled: mode === 'full',
      env: {
        HMR_LAB_REPORT_DIR: path.join(reportRoot, 'hmr-lab-native'),
        HMR_LAB_ITERATIONS: process.env.HMR_LAB_ITERATIONS ?? (mode === 'full' ? '2' : '1'),
        HMR_LAB_FILTER: process.env.HMR_LAB_FILTER ?? (mode === 'full' ? '' : 'sfc'),
        HMR_LAB_AST_ENGINE: 'oxc',
        WEAPP_VITE_NATIVE: '1',
        WEAPP_VITE_NATIVE_AST_PATH: path.join(repoRoot, 'packages/ast-native/index.js'),
      },
      parse: summarizeHmrLabReport,
    },
    {
      id: 'auto-import-build',
      label: 'Auto Import Build',
      command: 'pnpm',
      args: ['--filter', 'weapp-vite', 'benchmark:auto-import:build'],
      reportDir: path.join(reportRoot, 'auto-import-build'),
      env: {
        BENCH_REPORT_DIR: path.join(reportRoot, 'auto-import-build'),
        BENCH_ITERATIONS: process.env.BENCH_ITERATIONS ?? (mode === 'full' ? '3' : '1'),
        BENCH_SCENARIOS: process.env.BENCH_SCENARIOS ?? (mode === 'full' ? '1,5,20' : '1'),
      },
      parse: summarizeAutoImportBuildReport,
    },
    {
      id: 'auto-import-hmr',
      label: 'Auto Import HMR',
      command: 'pnpm',
      args: ['--filter', 'weapp-vite', 'benchmark:auto-import:hmr'],
      reportDir: path.join(reportRoot, 'auto-import-hmr'),
      env: {
        BENCH_REPORT_DIR: path.join(reportRoot, 'auto-import-hmr'),
        BENCH_ITERATIONS: process.env.BENCH_ITERATIONS ?? (mode === 'full' ? '3' : '1'),
        BENCH_SCENARIOS: process.env.BENCH_SCENARIOS ?? (mode === 'full' ? '1,5,20' : '1'),
      },
      parse: summarizeAutoImportHmrReport,
    },
  ]

  if (mode === 'full') {
    suites.push({
      id: 'workspace-hmr',
      label: 'Workspace HMR Audit',
      command: 'pnpm',
      args: ['audit:hmr:changed'],
      reportDir: path.join(reportRoot, 'workspace-hmr'),
      env: {
        WORKSPACE_HMR_REPORT_DIR: path.join(reportRoot, 'workspace-hmr'),
        WORKSPACE_HMR_MODE: 'changed-project',
        WORKSPACE_HMR_SCOPE: 'workspace',
        WORKSPACE_HMR_FAIL_ON_ERROR: '0',
      },
      parse: summarizeWorkspaceHmrReport,
    })
  }

  return suites
}

async function runSuite(suite: SuiteConfig): Promise<SuiteResult> {
  await mkdir(suite.reportDir, { recursive: true })
  const commandText = [suite.command, ...suite.args].join(' ')
  const startedAt = performance.now()
  process.stdout.write(`[performance-report] ${suite.id}: ${commandText}\n`)

  const result = await runCommand(suite.command, suite.args, {
    ...suite.env,
  })
  const durationMs = performance.now() - startedAt
  const reportJson = path.join(suite.reportDir, 'report.json')
  const reportMd = path.join(suite.reportDir, 'report.md')
  const summary = result.status === 0
    ? await suite.parse(reportJson).catch(error => ({
        parseError: error instanceof Error ? error.message : String(error),
      }))
    : undefined

  return {
    id: suite.id,
    label: suite.label,
    status: result.status === 0 ? 'passed' : 'failed',
    command: commandText,
    durationMs,
    reportJson: await pathExists(reportJson) ? formatReportPath(reportJson) : undefined,
    reportMd: await pathExists(reportMd) ? formatReportPath(reportMd) : undefined,
    error: result.status === 0 ? undefined : summarizeCommandOutput(result.output),
    summary,
  }
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return await new Promise<{ status: number, output: string }>((resolve) => {
    const chunks: string[] = []
    const child = spawn(resolveCommand(command), args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const onData = (chunk: Buffer) => {
      const text = chunk.toString()
      chunks.push(text)
      process.stdout.write(text)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('close', status => resolve({
      status: status ?? 1,
      output: chunks.join(''),
    }))
    child.on('error', error => resolve({
      status: 1,
      output: error.message,
    }))
  })
}

async function collectDistSizes() {
  const roots = ['packages', 'packages-runtime', '@weapp-core', 'extensions']
  const entries: DistSizeEntry[] = []
  for (const root of roots) {
    const rootDir = path.join(repoRoot, root)
    const names = await readdir(rootDir).catch(() => [])
    for (const name of names) {
      const packageDir = path.join(rootDir, name)
      const packageJsonPath = path.join(packageDir, 'package.json')
      const distDir = path.join(packageDir, 'dist')
      if (!await pathExists(packageJsonPath) || !await isDirectory(distDir)) {
        continue
      }
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string }
      const size = await getDirectorySize(distDir)
      entries.push({
        name: packageJson.name ?? path.relative(repoRoot, packageDir),
        relativeDir: path.relative(repoRoot, packageDir),
        ...size,
      })
    }
  }

  entries.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
  return {
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    totalGzipBytes: entries.reduce((sum, entry) => sum + entry.gzipBytes, 0),
    totalFiles: entries.reduce((sum, entry) => sum + entry.fileCount, 0),
    entries,
  }
}

async function getDirectorySize(dir: string): Promise<{ bytes: number, gzipBytes: number, fileCount: number }> {
  let bytes = 0
  let gzipBytes = 0
  let fileCount = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const child = await getDirectorySize(target)
      bytes += child.bytes
      gzipBytes += child.gzipBytes
      fileCount += child.fileCount
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const content = await readFile(target)
    bytes += content.byteLength
    gzipBytes += gzipSync(content, { level: 9 }).byteLength
    fileCount += 1
  }
  return { bytes, gzipBytes, fileCount }
}

async function summarizeHmrLabReport(reportJson: string) {
  const report = await readJson<{
    startupMs?: number
    scenarios?: Array<{
      id: string
      label: string
      averageMs?: number
      averageTransformMs?: number
      averageEmitMs?: number
      averageImpactCount?: number
      error?: string
    }>
  }>(reportJson)
  const scenarios = report.scenarios ?? []
  return {
    startupMs: round(report.startupMs),
    scenarioCount: scenarios.length,
    failedScenarioCount: scenarios.filter(scenario => scenario.error).length,
    slowest: scenarios
      .filter(scenario => typeof scenario.averageMs === 'number')
      .sort((a, b) => (b.averageMs ?? 0) - (a.averageMs ?? 0))
      .slice(0, 5)
      .map(scenario => ({
        id: scenario.id,
        label: scenario.label,
        averageMs: round(scenario.averageMs),
        transformMs: round(scenario.averageTransformMs),
        emitMs: round(scenario.averageEmitMs),
        impactCount: round(scenario.averageImpactCount),
      })),
  }
}

async function summarizeWorkspaceHmrReport(reportJson: string) {
  const report = await readJson<{
    summary?: Record<string, unknown>
    thresholds?: { issues?: unknown[] }
  }>(reportJson)
  return {
    summary: report.summary ?? {},
    thresholdIssueCount: report.thresholds?.issues?.length ?? 0,
  }
}

async function summarizeAutoImportBuildReport(reportJson: string) {
  const report = await readJson<{
    iterations?: number
    results?: Array<{
      usedCount: number
      baseline?: { mean?: number }
      current?: { mean?: number }
      delta?: { extraMs?: number, extraPercent?: number, ratio?: number }
    }>
  }>(reportJson)
  return {
    iterations: report.iterations,
    scenarios: (report.results ?? []).map(result => ({
      usedCount: result.usedCount,
      baselineMs: round(result.baseline?.mean),
      currentMs: round(result.current?.mean),
      extraMs: round(result.delta?.extraMs),
      extraPercent: round(result.delta?.extraPercent),
      ratio: round(result.delta?.ratio),
    })),
  }
}

async function summarizeAutoImportHmrReport(reportJson: string) {
  const report = await readJson<{
    iterations?: number
    results?: Array<{
      usedCount: number
      startup?: {
        baseline?: { mean?: number }
        current?: { mean?: number }
        delta?: { extraMs?: number, extraPercent?: number, ratio?: number }
      }
      update?: {
        baseline?: { mean?: number }
        current?: { mean?: number }
        delta?: { extraMs?: number, extraPercent?: number, ratio?: number }
      }
    }>
  }>(reportJson)
  return {
    iterations: report.iterations,
    scenarios: (report.results ?? []).map(result => ({
      usedCount: result.usedCount,
      startupExtraMs: round(result.startup?.delta?.extraMs),
      startupExtraPercent: round(result.startup?.delta?.extraPercent),
      updateExtraMs: round(result.update?.delta?.extraMs),
      updateExtraPercent: round(result.update?.delta?.extraPercent),
      updateRatio: round(result.update?.delta?.ratio),
    })),
  }
}

function collectHotTargets(suites: SuiteResult[], dist: PerformanceReport['dist']): PerformanceReport['hotTargets'] {
  const targets: PerformanceReport['hotTargets'] = []
  for (const suite of suites) {
    if (suite.status === 'failed') {
      targets.push({
        area: suite.label,
        metric: 'suite-failed',
        value: suite.error ?? 'failed',
        source: suite.reportJson ?? suite.id,
      })
    }
    if (isHmrLabSummary(suite.summary)) {
      const slowest = (suite.summary?.slowest as Array<{ id: string, averageMs?: number }> | undefined) ?? []
      for (const scenario of slowest.slice(0, 3)) {
        targets.push({
          area: suite.label,
          metric: scenario.id,
          value: scenario.averageMs ?? 0,
          source: suite.reportJson ?? suite.id,
        })
      }
    }
  }
  for (const entry of dist.entries.slice(0, 5)) {
    targets.push({
      area: 'dist-size',
      metric: entry.name,
      value: entry.bytes,
      source: entry.relativeDir,
    })
  }
  return targets
}

function renderMarkdown(report: PerformanceReport) {
  const lines = [
    '# weapp-vite 性能对比报告',
    '',
    `- 生成时间：\`${report.generatedAt}\``,
    `- 模式：\`${report.mode}\``,
    `- commit：\`${report.commit}\``,
    `- 报告目录：\`${report.reportRoot}\``,
    '',
    '## 运行套件',
    '',
    '| 套件 | 状态 | 耗时 | 报告 | 摘要 |',
    '| --- | --- | ---: | --- | --- |',
  ]
  if (report.baseline) {
    lines.splice(
      6,
      0,
      `- 对比基线：\`${report.baseline.report}\` (${report.baseline.commit}, ${report.baseline.generatedAt})`,
    )
  }

  for (const suite of report.suites) {
    lines.push(`| ${suite.label} | ${suite.status} | ${formatDuration(suite.durationMs)} | ${suite.reportMd ? `\`${suite.reportMd}\`` : '-'} | ${renderSuiteSummary(suite)} |`)
  }
  if (report.suites.length === 0) {
    lines.push('| collect-only | passed | - | - | 仅聚合现有 dist 体积 |')
  }

  renderComparisonSection(lines, report.comparison)

  lines.push('')
  lines.push('## Dist 体积 Top 10')
  lines.push('')
  lines.push(`- 总体积：\`${formatBytes(report.dist.totalBytes)}\``)
  lines.push(`- gzip 体积：\`${formatBytes(report.dist.totalGzipBytes)}\``)
  lines.push(`- 文件数：\`${report.dist.totalFiles}\``)
  lines.push('')
  lines.push('| Package | Size | Gzip | Files | Path |')
  lines.push('| --- | ---: | ---: | ---: | --- |')
  for (const entry of report.dist.entries.slice(0, 10)) {
    lines.push(`| ${entry.name} | ${formatBytes(entry.bytes)} | ${formatBytes(entry.gzipBytes)} | ${entry.fileCount} | \`${entry.relativeDir}\` |`)
  }

  lines.push('')
  lines.push('## 下一批热点')
  lines.push('')
  lines.push('| Area | Metric | Value | Source |')
  lines.push('| --- | --- | ---: | --- |')
  for (const target of report.hotTargets.slice(0, 12)) {
    lines.push(`| ${target.area} | ${target.metric} | ${formatTargetValue(target.value)} | \`${target.source}\` |`)
  }
  lines.push('')
  lines.push('## 推荐运行方式')
  lines.push('')
  lines.push('- 快速聚合：`pnpm performance:report -- --mode=collect`')
  lines.push('- Smoke 基准：`pnpm performance:report -- --mode=smoke`')
  lines.push('- 完整基准：`pnpm performance:report -- --mode=full`')
  lines.push('- 对比基线：`pnpm performance:report -- --mode=smoke --baseline=.tmp/performance-report/<baseline>/report.json`')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function renderComparisonSection(lines: string[], comparison: PerformanceComparison | undefined) {
  if (!comparison) {
    return
  }

  const metrics = [...comparison.dist, ...comparison.suites]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 20)

  lines.push('')
  lines.push('## 与基线对比')
  lines.push('')
  if (metrics.length === 0) {
    lines.push('- 没有可对比指标。')
    return
  }

  lines.push('| Area | Metric | Current | Baseline | Delta | Source |')
  lines.push('| --- | --- | ---: | ---: | ---: | --- |')
  for (const metric of metrics) {
    lines.push(`| ${metric.area} | ${metric.metric} | ${formatMetricValue(metric.current, metric.unit)} | ${formatMetricValue(metric.baseline, metric.unit)} | ${formatMetricDelta(metric)} | \`${metric.source}\` |`)
  }
}

function renderSuiteSummary(suite: SuiteResult) {
  if (suite.error) {
    return suite.error.replace(/\|/g, '\\|')
  }
  if (!suite.summary) {
    return '-'
  }
  if (isHmrLabSummary(suite.summary)) {
    const slowest = (suite.summary.slowest as Array<{ id: string, averageMs?: number }> | undefined)?.[0]
    return slowest ? `${slowest.id}: ${formatDuration(slowest.averageMs)}` : `startup ${formatDuration(suite.summary.startupMs as number | undefined)}`
  }
  if (suite.id === 'auto-import-build') {
    const scenarios = suite.summary.scenarios as Array<{ usedCount: number, extraMs?: number }> | undefined
    const worst = scenarios?.slice().sort((a, b) => (b.extraMs ?? 0) - (a.extraMs ?? 0))[0]
    return worst ? `${worst.usedCount} components: ${formatDuration(worst.extraMs)} extra` : '-'
  }
  if (suite.id === 'auto-import-hmr') {
    const scenarios = suite.summary.scenarios as Array<{ usedCount: number, updateExtraMs?: number }> | undefined
    const worst = scenarios?.slice().sort((a, b) => (b.updateExtraMs ?? 0) - (a.updateExtraMs ?? 0))[0]
    return worst ? `${worst.usedCount} components: ${formatDuration(worst.updateExtraMs)} update extra` : '-'
  }
  return JSON.stringify(suite.summary).replace(/\|/g, '\\|')
}

function renderConsoleSummary(report: PerformanceReport) {
  return [
    `[performance-report] report.json -> ${formatReportPath(reportJsonPath)}`,
    `[performance-report] report.md -> ${formatReportPath(reportMdPath)}`,
    `[performance-report] suites=${report.suites.length} dist=${formatBytes(report.dist.totalBytes)} files=${report.dist.totalFiles}`,
  ].join('\n')
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
}

async function readBaselineReport() {
  if (!baselineReportPath) {
    return undefined
  }

  const resolvedPath = path.resolve(repoRoot, baselineReportPath)
  const reportPath = await isDirectory(resolvedPath) ? path.join(resolvedPath, 'report.json') : resolvedPath
  return {
    path: reportPath,
    report: await readJson<PerformanceReport>(reportPath),
  }
}

function compareReports(
  current: Pick<PerformanceReport, 'suites' | 'dist'>,
  baseline: Pick<PerformanceReport, 'suites' | 'dist'>,
): PerformanceComparison {
  const dist: MetricComparison[] = [
    createComparison('dist-size', 'total-bytes', 'bytes', current.dist.totalBytes, baseline.dist.totalBytes, 'dist'),
    createComparison('dist-size', 'total-gzip-bytes', 'bytes', current.dist.totalGzipBytes, baseline.dist.totalGzipBytes, 'dist'),
    createComparison('dist-size', 'total-files', 'count', current.dist.totalFiles, baseline.dist.totalFiles, 'dist'),
  ]
  const baselineDistByName = new Map(baseline.dist.entries.map(entry => [entry.name, entry]))
  for (const entry of current.dist.entries) {
    const baselineEntry = baselineDistByName.get(entry.name)
    if (!baselineEntry) {
      continue
    }
    dist.push(createComparison('dist-size', `${entry.name}:bytes`, 'bytes', entry.bytes, baselineEntry.bytes, entry.relativeDir))
    dist.push(createComparison('dist-size', `${entry.name}:gzip`, 'bytes', entry.gzipBytes, baselineEntry.gzipBytes, entry.relativeDir))
  }

  const suites: MetricComparison[] = []
  const baselineSuitesById = new Map(baseline.suites.map(suite => [suite.id, suite]))
  for (const suite of current.suites) {
    const baselineSuite = baselineSuitesById.get(suite.id)
    if (!baselineSuite) {
      continue
    }
    if (typeof suite.durationMs === 'number' && typeof baselineSuite.durationMs === 'number') {
      suites.push(createComparison(suite.label, 'suite-duration', 'ms', suite.durationMs, baselineSuite.durationMs, suite.reportJson ?? suite.id))
    }
    suites.push(...compareSuiteSummaries(suite, baselineSuite))
  }

  return {
    dist,
    suites,
  }
}

function compareSuiteSummaries(current: SuiteResult, baseline: SuiteResult) {
  if (!current.summary || !baseline.summary) {
    return []
  }

  const metrics: MetricComparison[] = []
  const currentMetrics = extractSuiteSummaryMetrics(current)
  const baselineMetrics = extractSuiteSummaryMetrics(baseline)
  for (const [metric, value] of currentMetrics) {
    const baselineValue = baselineMetrics.get(metric)
    if (typeof baselineValue !== 'number') {
      continue
    }
    metrics.push(createComparison(
      current.label,
      metric,
      metric.includes('Percent') ? 'percent' : 'ms',
      value,
      baselineValue,
      current.reportJson ?? current.id,
    ))
  }
  return metrics
}

function extractSuiteSummaryMetrics(suite: SuiteResult) {
  const metrics = new Map<string, number>()
  if (!suite.summary) {
    return metrics
  }

  if (isHmrLabSummary(suite.summary)) {
    addNumberMetric(metrics, 'startupMs', suite.summary.startupMs)
    for (const scenario of (suite.summary.slowest as Array<{ id: string, averageMs?: number, transformMs?: number, emitMs?: number }> | undefined) ?? []) {
      addNumberMetric(metrics, `${scenario.id}:averageMs`, scenario.averageMs)
      addNumberMetric(metrics, `${scenario.id}:transformMs`, scenario.transformMs)
      addNumberMetric(metrics, `${scenario.id}:emitMs`, scenario.emitMs)
    }
  }
  if (suite.id === 'auto-import-build') {
    for (const scenario of (suite.summary.scenarios as Array<{ usedCount: number, extraMs?: number, extraPercent?: number }> | undefined) ?? []) {
      addNumberMetric(metrics, `${scenario.usedCount}:extraMs`, scenario.extraMs)
      addNumberMetric(metrics, `${scenario.usedCount}:extraPercent`, scenario.extraPercent)
    }
  }
  if (suite.id === 'auto-import-hmr') {
    for (const scenario of (suite.summary.scenarios as Array<{ usedCount: number, startupExtraMs?: number, startupExtraPercent?: number, updateExtraMs?: number, updateExtraPercent?: number }> | undefined) ?? []) {
      addNumberMetric(metrics, `${scenario.usedCount}:startupExtraMs`, scenario.startupExtraMs)
      addNumberMetric(metrics, `${scenario.usedCount}:startupExtraPercent`, scenario.startupExtraPercent)
      addNumberMetric(metrics, `${scenario.usedCount}:updateExtraMs`, scenario.updateExtraMs)
      addNumberMetric(metrics, `${scenario.usedCount}:updateExtraPercent`, scenario.updateExtraPercent)
    }
  }

  return metrics
}

function addNumberMetric(metrics: Map<string, number>, key: string, value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    metrics.set(key, value)
  }
}

function isHmrLabSummary(summary: Record<string, unknown> | undefined) {
  return Array.isArray(summary?.slowest) && typeof summary?.scenarioCount === 'number'
}

function createComparison(
  area: string,
  metric: string,
  unit: MetricComparison['unit'],
  current: number,
  baseline: number,
  source: string,
): MetricComparison {
  const delta = current - baseline
  return {
    area,
    metric,
    unit,
    current: roundRequired(current),
    baseline: roundRequired(baseline),
    delta: roundRequired(delta),
    deltaPercent: baseline === 0 ? undefined : roundRequired(delta / baseline * 100),
    source,
  }
}

async function readGitCommit() {
  const head = await readFile(path.join(repoRoot, '.git/HEAD'), 'utf8').catch(() => '')
  const ref = head.match(/^ref: (.+)$/m)?.[1]
  if (ref) {
    const full = await readFile(path.join(repoRoot, '.git', ref), 'utf8').catch(() => '')
    return full.trim().slice(0, 12) || 'unknown'
  }
  return head.trim().slice(0, 12) || 'unknown'
}

async function pathExists(file: string) {
  return await stat(file).then(() => true, () => false)
}

async function isDirectory(file: string) {
  return await stat(file).then(value => value.isDirectory(), () => false)
}

function readMode(value: string): ReportMode {
  if (value === 'collect' || value === 'smoke' || value === 'full') {
    return value
  }
  throw new Error(`Invalid performance report mode: ${value}`)
}

function readArgValue(name: string) {
  const prefix = `${name}=`
  const arg = process.argv.slice(2).find(value => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

function resolveCommand(command: string) {
  return process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command
}

function formatTimestamp(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = -1
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

function formatDuration(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} ms` : '-'
}

function formatTargetValue(value: number | string) {
  return typeof value === 'number' ? value.toFixed(2) : value.replace(/\|/g, '\\|')
}

function formatMetricValue(value: number, unit: MetricComparison['unit']) {
  if (unit === 'bytes') {
    return formatBytes(value)
  }
  if (unit === 'ms') {
    return formatDuration(value)
  }
  if (unit === 'percent') {
    return `${value.toFixed(2)}%`
  }
  if (unit === 'ratio') {
    return value.toFixed(2)
  }
  return value.toFixed(0)
}

function formatMetricDelta(metric: MetricComparison) {
  const prefix = metric.delta > 0 ? '+' : ''
  const value = `${prefix}${formatMetricValue(metric.delta, metric.unit)}`
  const percentPrefix = metric.deltaPercent !== undefined && metric.deltaPercent > 0 ? '+' : ''
  return typeof metric.deltaPercent === 'number' ? `${value} (${percentPrefix}${metric.deltaPercent.toFixed(2)}%)` : value
}

function formatReportPath(file: string) {
  return path.relative(repoRoot, file) || '.'
}

function round(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(2)) : undefined
}

function roundRequired(value: number) {
  return Number(value.toFixed(2))
}

function summarizeCommandOutput(output: string) {
  const lines = output.trim().split('\n').filter(Boolean)
  return lines.slice(-12).join('\n')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
