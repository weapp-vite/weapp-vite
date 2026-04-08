/* eslint-disable ts/no-use-before-define */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import process from 'node:process'
/* eslint-disable-next-line e18e/ban-dependencies -- benchmark orchestration uses child processes to run dedicated scripts and collect reports. */
import { execa } from 'execa'
import path from 'pathe'

const thresholdPercent = Number.parseFloat(process.env.AUTO_IMPORT_BENCH_THRESHOLD_PERCENT ?? '10')
const minExtraMs = Number.parseFloat(process.env.AUTO_IMPORT_BENCH_MIN_EXTRA_MS ?? '80')
const iterations = process.env.BENCH_ITERATIONS ?? '2'
const scenarios = process.env.BENCH_SCENARIOS ?? '1,20'
const reportRootDir = process.env.AUTO_IMPORT_BENCH_REPORT_DIR
  ? path.resolve(process.env.AUTO_IMPORT_BENCH_REPORT_DIR)
  : path.resolve(import.meta.dirname, '../benchmark/auto-import-ci', formatTimestamp(new Date()))
const buildReportDir = path.join(reportRootDir, 'build')
const hmrReportDir = path.join(reportRootDir, 'hmr')
const combinedReportJsonPath = path.join(reportRootDir, 'report.json')
const combinedReportMdPath = path.join(reportRootDir, 'report.md')
const workspaceRootNodeModulesDir = await resolveWorkspaceNodeModulesDir()
const workspaceRootDir = path.dirname(workspaceRootNodeModulesDir)

if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) {
  throw new Error(`Invalid AUTO_IMPORT_BENCH_THRESHOLD_PERCENT value: ${thresholdPercent}`)
}

if (!Number.isFinite(minExtraMs) || minExtraMs < 0) {
  throw new Error(`Invalid AUTO_IMPORT_BENCH_MIN_EXTRA_MS value: ${minExtraMs}`)
}

async function main() {
  await rm(reportRootDir, { recursive: true, force: true }).catch(() => undefined)
  await mkdir(reportRootDir, { recursive: true })

  await ensureWeappViteBuilt()
  await runBenchmarkScript('benchmark-auto-import-build.ts', buildReportDir)
  await runBenchmarkScript('benchmark-auto-import-hmr.ts', hmrReportDir)

  const buildReport = await readJson(path.join(buildReportDir, 'report.json')) as BuildBenchmarkReport
  const hmrReport = await readJson(path.join(hmrReportDir, 'report.json')) as HmrBenchmarkReport
  const failures = collectFailures(buildReport, hmrReport, thresholdPercent, minExtraMs)
  const combinedReport = {
    generatedAt: new Date().toISOString(),
    thresholdPercent,
    minExtraMs,
    iterations,
    scenarios,
    build: buildReport,
    hmr: hmrReport,
    failures,
  }

  const markdown = renderMarkdown(combinedReport)
  await writeFile(combinedReportJsonPath, JSON.stringify(combinedReport, null, 2))
  await writeFile(combinedReportMdPath, markdown, 'utf8')

  process.stdout.write(`${markdown}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, {
      encoding: 'utf8',
      flag: 'a',
    })
  }

  if (failures.length > 0) {
    throw new Error(
      `auto-import benchmark regression exceeds ${thresholdPercent}% threshold:\n${failures.map(formatFailure).join('\n')}`,
    )
  }
}

async function runBenchmarkScript(scriptName: string, reportDir: string) {
  await mkdir(reportDir, { recursive: true })
  await execa(process.execPath, ['--import', 'tsx', path.resolve(import.meta.dirname, scriptName)], {
    cwd: workspaceRootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${path.join(workspaceRootNodeModulesDir, '.bin')}:${process.env.PATH ?? ''}`,
      BENCH_ITERATIONS: iterations,
      BENCH_SCENARIOS: scenarios,
      BENCH_REPORT_DIR: reportDir,
    },
  })
}

async function ensureWeappViteBuilt() {
  await execa('pnpm', ['--filter', 'weapp-vite', 'build'], {
    cwd: workspaceRootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${path.join(workspaceRootNodeModulesDir, '.bin')}:${process.env.PATH ?? ''}`,
    },
  })
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function collectFailures(
  buildReport: BuildBenchmarkReport,
  hmrReport: HmrBenchmarkReport,
  thresholdPercentValue: number,
  minExtraMsValue: number,
) {
  const failures: FailureRecord[] = []

  for (const scenario of buildReport.results) {
    if (scenario.delta.extraPercent > thresholdPercentValue && scenario.delta.extraMs > minExtraMsValue) {
      failures.push({
        kind: 'build',
        usedCount: scenario.usedCount,
        extraPercent: scenario.delta.extraPercent,
        extraMs: scenario.delta.extraMs,
      })
    }
  }

  for (const scenario of hmrReport.results) {
    if (scenario.update.delta.extraPercent > thresholdPercentValue && scenario.update.delta.extraMs > minExtraMsValue) {
      failures.push({
        kind: 'hmr',
        usedCount: scenario.usedCount,
        extraPercent: scenario.update.delta.extraPercent,
        extraMs: scenario.update.delta.extraMs,
      })
    }
  }

  return failures
}

function formatFailure(failure: FailureRecord) {
  return `- ${failure.kind} / ${failure.usedCount} components: +${failure.extraMs.toFixed(2)}ms (${failure.extraPercent.toFixed(2)}%)`
}

function renderMarkdown(report: {
  thresholdPercent: number
  minExtraMs: number
  iterations: string
  scenarios: string
  build: BuildBenchmarkReport
  hmr: HmrBenchmarkReport
  failures: FailureRecord[]
}) {
  const lines = [
    '# Auto Import Performance CI Report',
    '',
    `- threshold: \`${report.thresholdPercent}%\``,
    `- min extra cost: \`${report.minExtraMs} ms\``,
    `- iterations: \`${report.iterations}\``,
    `- scenarios: \`${report.scenarios}\``,
    `- status: ${report.failures.length === 0 ? 'pass' : 'fail'}`,
    '',
    '## Build',
    '',
    '| 场景 | baseline avg | current avg | 额外成本 | 阈值结果 |',
    '| --- | ---: | ---: | ---: | --- |',
  ]

  for (const result of report.build.results) {
    const status = result.delta.extraPercent > report.thresholdPercent && result.delta.extraMs > report.minExtraMs
      ? 'fail'
      : 'pass'
    lines.push(
      `| ${result.usedCount} components | ${result.baseline.mean.toFixed(2)} ms | ${result.current.mean.toFixed(2)} ms | ${result.delta.extraMs.toFixed(2)} ms (${result.delta.extraPercent.toFixed(2)}%) | ${status} |`,
    )
  }

  lines.push('')
  lines.push('## HMR')
  lines.push('')
  lines.push('| 场景 | baseline avg | current avg | 额外成本 | 阈值结果 |')
  lines.push('| --- | ---: | ---: | ---: | --- |')

  for (const result of report.hmr.results) {
    const status = result.update.delta.extraPercent > report.thresholdPercent && result.update.delta.extraMs > report.minExtraMs
      ? 'fail'
      : 'pass'
    lines.push(
      `| ${result.usedCount} components | ${result.update.baseline.mean.toFixed(2)} ms | ${result.update.current.mean.toFixed(2)} ms | ${result.update.delta.extraMs.toFixed(2)} ms (${result.update.delta.extraPercent.toFixed(2)}%) | ${status} |`,
    )
  }

  lines.push('')
  lines.push('## 结论')
  lines.push('')
  if (report.failures.length === 0) {
    lines.push(`- 所有 build / HMR 场景均未同时超过 \`${report.thresholdPercent}%\` 与 \`${report.minExtraMs} ms\` 双阈值。`)
  }
  else {
    lines.push(`- 以下场景同时超过 \`${report.thresholdPercent}%\` 与 \`${report.minExtraMs} ms\` 阈值：`)
    for (const failure of report.failures) {
      lines.push(`- ${formatFailure(failure)}`)
    }
  }

  return lines.join('\n')
}

async function resolveWorkspaceNodeModulesDir() {
  let currentDir = path.resolve(import.meta.dirname, '../../..')
  while (true) {
    const candidate = path.join(currentDir, 'node_modules')
    try {
      await readFile(path.join(candidate, '.modules.yaml'))
      return candidate
    }
    catch {
      // ignore
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }
    currentDir = parentDir
  }
  throw new Error('Unable to locate workspace node_modules directory for auto-import benchmark CI.')
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

interface SummaryStats {
  min: number
  max: number
  mean: number
  median: number
}

interface BuildBenchmarkReport {
  iterations: number
  generatedAt: string
  results: Array<{
    usedCount: number
    baseline: SummaryStats
    current: SummaryStats
    delta: {
      extraMs: number
      extraPercent: number
      ratio: number
    }
  }>
}

interface HmrBenchmarkReport {
  iterations: number
  generatedAt: string
  results: Array<{
    usedCount: number
    startup: {
      baseline: SummaryStats
      current: SummaryStats
      delta: {
        extraMs: number
        extraPercent: number
        ratio: number
      }
    }
    update: {
      baseline: SummaryStats
      current: SummaryStats
      delta: {
        extraMs: number
        extraPercent: number
        ratio: number
      }
    }
  }>
}

interface FailureRecord {
  kind: 'build' | 'hmr'
  usedCount: number
  extraPercent: number
  extraMs: number
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
