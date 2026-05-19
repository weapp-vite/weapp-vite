/* eslint-disable ts/no-use-before-define */
import { access, cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cleanupProcessesByCommandPatterns, startDevProcess } from '../e2e/utils/dev-process'
import { createDevProcessEnv } from '../e2e/utils/dev-process-env'
import { replaceFileByRename } from '../e2e/utils/hmr-helpers'

interface HmrProfileJsonSample {
  buildCoreMs?: number
  dirtyReasonSummary?: string[]
  emitMs?: number
  emittedCount?: number
  file?: string
  pendingCount?: number
  pendingReasonSummary?: string[]
  totalMs?: number
  transformMs?: number
  watchToDirtyMs?: number
  writeMs?: number
}

interface ScenarioCase {
  id: string
  group: string
  label: string
  outputFile: string
  outputMarker: (marker: string) => string
  sourceFile: string
  mutate: (source: string, marker: string) => string
}

interface ScenarioSample extends HmrProfileJsonSample {
  wallMs: number
}

interface ScenarioResult {
  averageMs?: number
  averageWallMs: number
  group: string
  id: string
  label: string
  maxMs?: number
  maxWallMs: number
  outputFile: string
  overBudget: boolean
  samples: ScenarioSample[]
  sourceFile: string
}

interface BenchmarkReport {
  budgetMs: number
  generatedAt: string
  iterations: number
  project: {
    source: string
    workspace: string
  }
  scenarios: ScenarioResult[]
  summary: {
    maxMs?: number
    maxWallMs: number
    overBudgetCount: number
    scenarioCount: number
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const templateRoot = path.join(repoRoot, 'templates/weapp-vite-wevu-template')
const workspaceRoot = path.resolve(process.env.WEVU_TEMPLATE_HMR_WORKSPACE ?? path.join(repoRoot, '.tmp/wevu-template-hmr-workspace'))
const reportRoot = path.resolve(process.env.WEVU_TEMPLATE_HMR_REPORT_DIR ?? path.join(repoRoot, '.tmp/wevu-template-hmr-report'))
const reportJsonPath = path.join(reportRoot, 'report.json')
const reportMdPath = path.join(reportRoot, 'report.md')
const cliPath = path.resolve(process.env.WEVU_TEMPLATE_HMR_CLI_PATH ?? path.join(repoRoot, 'packages/weapp-vite/bin/weapp-vite.js'))
const iterations = Number.parseInt(process.env.WEVU_TEMPLATE_HMR_ITERATIONS ?? '1', 10)
const budgetMs = Number.parseInt(process.env.WEVU_TEMPLATE_HMR_BUDGET_MS ?? '500', 10)
const timeoutMs = Number.parseInt(process.env.WEVU_TEMPLATE_HMR_TIMEOUT_MS ?? '30000', 10)
const keepWorkspace = process.env.WEVU_TEMPLATE_HMR_KEEP_WORKSPACE === '1'

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid WEVU_TEMPLATE_HMR_ITERATIONS: ${String(process.env.WEVU_TEMPLATE_HMR_ITERATIONS)}`)
}

if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
  throw new Error(`Invalid WEVU_TEMPLATE_HMR_BUDGET_MS: ${String(process.env.WEVU_TEMPLATE_HMR_BUDGET_MS)}`)
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error(`Invalid WEVU_TEMPLATE_HMR_TIMEOUT_MS: ${String(process.env.WEVU_TEMPLATE_HMR_TIMEOUT_MS)}`)
}

const src = (...segments: string[]) => path.join(workspaceRoot, 'src', ...segments)
const dist = (...segments: string[]) => path.join(workspaceRoot, 'dist', ...segments)

const cases: ScenarioCase[] = [
  {
    id: 'page-index-json-macro',
    group: 'page',
    label: 'pages/index definePageJson',
    sourceFile: src('pages/index/index.vue'),
    outputFile: dist('pages/index/index.json'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace(/navigationBarTitleText:\s*'[^']*'/, `navigationBarTitleText: '${marker}'`),
  },
  {
    id: 'page-index-script',
    group: 'page',
    label: 'pages/index script setup',
    sourceFile: src('pages/index/index.vue'),
    outputFile: dist('pages/index/index.js'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('const count = ref(0)', `const count = ref(0)\nconst __hmrScriptMarker = '${marker}'\nconsole.log(__hmrScriptMarker)`),
  },
  {
    id: 'page-index-template',
    group: 'page',
    label: 'pages/index template',
    sourceFile: src('pages/index/index.vue'),
    outputFile: dist('pages/index/index.wxml'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('Weapp-vite + Wevu', `Weapp-vite + Wevu ${marker}`),
  },
  {
    id: 'page-index-style',
    group: 'page',
    label: 'pages/index style',
    sourceFile: src('pages/index/index.vue'),
    outputFile: dist('pages/index/index.wxss'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('background: #f3f6fb;', `background: #f3f6fb;\n  --hmr-style-marker: '${marker}';`),
  },
  {
    id: 'page-layouts-json-macro',
    group: 'page',
    label: 'pages/layouts definePageJson',
    sourceFile: src('pages/layouts/index.vue'),
    outputFile: dist('pages/layouts/index.json'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace(/navigationBarTitleText:\s*'[^']*'/, `navigationBarTitleText: '${marker}'`),
  },
  {
    id: 'page-layouts-template',
    group: 'page',
    label: 'pages/layouts template',
    sourceFile: src('pages/layouts/index.vue'),
    outputFile: dist('pages/layouts/index.wxml'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('Layout Playground', `Layout Playground ${marker}`),
  },
  {
    id: 'layout-default-template',
    group: 'layout',
    label: 'layouts/default template',
    sourceFile: src('layouts/default.vue'),
    outputFile: dist('layouts/default.wxml'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('<slot />', `<text>${marker}</text><slot />`),
  },
  {
    id: 'layout-default-style',
    group: 'layout',
    label: 'layouts/default style',
    sourceFile: src('layouts/default.vue'),
    outputFile: dist('layouts/default.wxss'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('min-height: 100%;', `min-height: 100%;\n  --hmr-layout-style-marker: '${marker}';`),
  },
  {
    id: 'layout-admin-script',
    group: 'layout',
    label: 'layouts/admin script',
    sourceFile: src('layouts/admin.vue'),
    outputFile: dist('layouts/admin.js'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('defineComponentJson({', `const __hmrAdminScriptMarker = '${marker}'\nconsole.log(__hmrAdminScriptMarker)\n\ndefineComponentJson({`),
  },
  {
    id: 'app-json-macro',
    group: 'app',
    label: 'app defineAppJson',
    sourceFile: src('app.vue'),
    outputFile: dist('app.json'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace(/navigationBarTitleText:\s*'[^']*'/, `navigationBarTitleText: '${marker}'`),
  },
  {
    id: 'app-style',
    group: 'app',
    label: 'app style',
    sourceFile: src('app.vue'),
    outputFile: dist('app.wxss'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('background: #f3f6fb;', `background: #f3f6fb;\n  --hmr-app-style-marker: '${marker}';`),
  },
  {
    id: 'json-sitemap',
    group: 'json',
    label: 'sitemap.json',
    sourceFile: src('sitemap.json'),
    outputFile: dist('sitemap.json'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('"action": "allow"', `"action": "allow",\n      "hmrMarker": "${marker}"`),
  },
  {
    id: 'json-theme',
    group: 'json',
    label: 'theme.json',
    sourceFile: src('theme.json'),
    outputFile: dist('theme.json'),
    outputMarker: marker => marker,
    mutate: (source, marker) => source.replace('"light": {}', `"light": { "hmrMarker": "${marker}" }`),
  },
]

async function main() {
  await mkdir(reportRoot, { recursive: true })
  await prepareWorkspace()
  const profilePath = path.join(workspaceRoot, '.weapp-vite/hmr-profile.jsonl')
  await rm(profilePath, { force: true }).catch(() => {})
  await cleanupProcessesByCommandPatterns([workspaceRoot], 2_500).catch(() => {})

  const dev = startDevProcess(process.execPath, [
    cliPath,
    'dev',
    normalizePath(path.relative(repoRoot, workspaceRoot)),
    '--platform',
    'weapp',
    '--skipNpm',
  ], {
    cwd: repoRoot,
    env: {
      ...createDevProcessEnv({
        disableSidecarWatch: true,
      }),
      WEAPP_VITE_HMR_PROFILE_JSON: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
  })

  try {
    await dev.waitFor(waitForFile(dist('app.js'), 120_000), 'initial app.js generated')

    const scenarios: ScenarioResult[] = []
    for (const scenario of cases) {
      scenarios.push(await benchmarkScenario(profilePath, scenario))
    }

    const report = createReport(scenarios)
    await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(reportMdPath, renderMarkdown(report), 'utf8')
    process.stdout.write(`\n[wevu-template-hmr] report.json -> ${reportJsonPath}\n`)
    process.stdout.write(`[wevu-template-hmr] report.md -> ${reportMdPath}\n`)
  }
  finally {
    await dev.stop(5_000).catch(() => {})
    if (!keepWorkspace) {
      await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {})
    }
  }
}

async function prepareWorkspace() {
  await rm(workspaceRoot, { recursive: true, force: true })
  await cp(templateRoot, workspaceRoot, {
    recursive: true,
    filter: (source) => {
      const ignoredDirs = ['dist', '.turbo', 'node_modules']
      return !ignoredDirs.some((dir) => {
        return source.includes(`${path.sep}${dir}${path.sep}`) || source.endsWith(`${path.sep}${dir}`)
      })
    },
  })
  await symlink(path.join(templateRoot, 'node_modules'), path.join(workspaceRoot, 'node_modules'), 'dir')
}

async function benchmarkScenario(profilePath: string, scenario: ScenarioCase): Promise<ScenarioResult> {
  const original = await readFile(scenario.sourceFile, 'utf8')
  const samples: ScenarioSample[] = []

  try {
    for (let index = 0; index < iterations; index += 1) {
      const marker = createMarker(scenario.id, index)
      const updated = scenario.mutate(original, marker)
      if (updated === original) {
        throw new Error(`Scenario ${scenario.id} did not mutate source.`)
      }

      const lineCount = await countJsonlLines(profilePath)
      const startedAt = performance.now()
      await replaceFileByRename(scenario.sourceFile, updated)
      await waitForFileContains(scenario.outputFile, scenario.outputMarker(marker), timeoutMs)
      const wallMs = performance.now() - startedAt
      const profileSample = await waitForHmrProfileSample(profilePath, scenario.sourceFile, lineCount, 5_000)
      const sample = {
        ...profileSample,
        file: formatReportPath(profileSample.file ?? scenario.sourceFile),
        totalMs: profileSample.totalMs ?? wallMs,
        wallMs,
      }
      samples.push(sample)
      process.stdout.write(`[wevu-template-hmr] ${scenario.id} ${index + 1}/${iterations} wall=${wallMs.toFixed(2)}ms total=${formatMs(sample.totalMs)}\n`)

      await replaceFileByRename(scenario.sourceFile, original)
      await sleep(300)
    }
  }
  finally {
    await writeFile(scenario.sourceFile, original, 'utf8').catch(() => {})
  }

  const maxMs = maxOptional(samples.map(sample => sample.totalMs))
  const maxWallMs = max(samples.map(sample => sample.wallMs))
  return {
    averageMs: averageOptional(samples.map(sample => sample.totalMs)),
    averageWallMs: average(samples.map(sample => sample.wallMs)),
    group: scenario.group,
    id: scenario.id,
    label: scenario.label,
    maxMs,
    maxWallMs,
    outputFile: formatReportPath(scenario.outputFile),
    overBudget: typeof maxMs === 'number' && maxMs > budgetMs,
    samples,
    sourceFile: formatReportPath(scenario.sourceFile),
  }
}

function createReport(scenarios: ScenarioResult[]): BenchmarkReport {
  const maxMs = maxOptional(scenarios.flatMap(scenario => scenario.samples.map(sample => sample.totalMs)))
  return {
    budgetMs,
    generatedAt: new Date().toISOString(),
    iterations,
    project: {
      source: formatReportPath(templateRoot),
      workspace: formatReportPath(workspaceRoot),
    },
    scenarios,
    summary: {
      maxMs,
      maxWallMs: max(scenarios.map(scenario => scenario.maxWallMs)),
      overBudgetCount: scenarios.filter(scenario => scenario.overBudget).length,
      scenarioCount: scenarios.length,
    },
  }
}

async function waitForFile(filePath: string, waitMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    if (await pathExists(filePath)) {
      return
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for file: ${filePath}`)
}

async function waitForFileContains(filePath: string, marker: string, waitMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    if (await pathExists(filePath)) {
      const content = await readFile(filePath, 'utf8')
      if (content.includes(marker)) {
        return
      }
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${filePath} to contain marker: ${marker}`)
}

async function waitForHmrProfileSample(
  profilePath: string,
  sourceFile: string,
  startLineCount: number,
  waitMs: number,
) {
  const startedAt = Date.now()
  let lastMatched: HmrProfileJsonSample | undefined
  while (Date.now() - startedAt < waitMs) {
    const samples = await readJsonlSamplesSince(profilePath, startLineCount)
    const matched = samples.findLast(sample => normalizePath(sample.file) === normalizePath(sourceFile))
    if (matched) {
      return matched
    }
    await sleep(100)
  }
  return lastMatched ?? {} satisfies HmrProfileJsonSample
}

async function countJsonlLines(filePath: string) {
  if (!(await pathExists(filePath))) {
    return 0
  }
  return (await readFile(filePath, 'utf8'))
    .split('\n')
    .filter(line => line.trim().length > 0)
    .length
}

async function readJsonlSamplesSince(filePath: string, startLineCount: number) {
  if (!(await pathExists(filePath))) {
    return []
  }
  return (await readFile(filePath, 'utf8'))
    .split('\n')
    .filter(line => line.trim().length > 0)
    .slice(Math.max(0, startLineCount))
    .map((line) => {
      try {
        return JSON.parse(line) as HmrProfileJsonSample
      }
      catch {
        return undefined
      }
    })
    .filter((sample): sample is HmrProfileJsonSample => sample !== undefined)
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

function createMarker(scenarioId: string, index: number) {
  return `WEVU-HMR-${scenarioId}-${index + 1}-${Date.now()}`
}

function normalizePath(value: string | undefined) {
  return (value ?? '').replaceAll('\\', '/')
}

function formatReportPath(value: string | undefined) {
  const normalized = normalizePath(value)
  if (!normalized) {
    return normalized
  }
  const relative = normalizePath(path.relative(repoRoot, normalized))
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : normalized
}

function average(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageOptional(values: Array<number | undefined>) {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return present.length ? average(present) : undefined
}

function max(values: number[]) {
  return values.length === 0 ? 0 : Math.max(...values)
}

function maxOptional(values: Array<number | undefined>) {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return present.length ? max(present) : undefined
}

function formatMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${value.toFixed(2)} ms`
}

function formatOptionalNumber(value: number | undefined) {
  return value === undefined || !Number.isFinite(value)
    ? '-'
    : value.toFixed(2)
}

function summarizeReasons(samples: ScenarioSample[], key: 'dirtyReasonSummary' | 'pendingReasonSummary') {
  const reasons = samples.flatMap(sample => sample[key] ?? [])
  if (!reasons.length) {
    return '-'
  }
  return [...new Set(reasons)]
    .map(reason => `${reason} x${reasons.filter(item => item === reason).length}`)
    .join('<br>')
}

function renderMarkdown(report: BenchmarkReport) {
  const lines = [
    '# wevu template HMR benchmark',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- source: ${report.project.source}`,
    `- workspace: ${report.project.workspace}`,
    `- iterations: ${report.iterations}`,
    `- budget: ${report.budgetMs} ms`,
    `- max profile total: ${formatMs(report.summary.maxMs)}`,
    `- max observed wall: ${formatMs(report.summary.maxWallMs)}`,
    `- over-budget scenarios: ${report.summary.overBudgetCount}/${report.summary.scenarioCount}`,
    '',
    '| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |',
  ]

  for (const scenario of report.scenarios) {
    const latestSample = scenario.samples[scenario.samples.length - 1]
    lines.push([
      scenario.group,
      scenario.label,
      formatMs(scenario.averageMs),
      formatMs(scenario.maxMs),
      formatMs(scenario.averageWallMs),
      formatMs(scenario.maxWallMs),
      latestSample?.pendingCount == null ? '-' : String(latestSample.pendingCount),
      latestSample?.emittedCount == null ? '-' : String(latestSample.emittedCount),
      summarizeReasons(scenario.samples, 'dirtyReasonSummary'),
      summarizeReasons(scenario.samples, 'pendingReasonSummary'),
      scenario.overBudget ? 'failed' : 'ok',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('')
  lines.push('## Samples')
  lines.push('')
  lines.push('| scenario | sample | total | build-core | transform | write | emit | watch-to-dirty | wall |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const scenario of report.scenarios) {
    scenario.samples.forEach((sample, index) => {
      lines.push([
        scenario.label,
        String(index + 1),
        formatOptionalNumber(sample.totalMs),
        formatOptionalNumber(sample.buildCoreMs),
        formatOptionalNumber(sample.transformMs),
        formatOptionalNumber(sample.writeMs),
        formatOptionalNumber(sample.emitMs),
        formatOptionalNumber(sample.watchToDirtyMs),
        formatOptionalNumber(sample.wallMs),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    })
  }

  return `${lines.join('\n')}\n`
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
