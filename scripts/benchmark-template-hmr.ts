/* eslint-disable ts/no-use-before-define */
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { startDevProcess } from '../e2e/utils/dev-process'
import { cleanupResidualDevProcesses } from '../e2e/utils/dev-process-cleanup'
import { createDevProcessEnv } from '../e2e/utils/dev-process-env'
import { replaceFileByRename, replaceHmrSfcTitle } from '../e2e/utils/hmr-helpers'

interface HmrProfileJsonSample {
  file?: string
  totalMs?: number
  transformMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  buildCoreMs?: number
}

interface ScenarioCase {
  id: string
  label: string
  sourceFile: string
  outputFile: string
  mutate: (original: string, marker: string) => string
}

interface ProjectCase {
  id: string
  projectRoot: string
  appJsonTarget: string
  startupTarget: string
  startupMarker: string
  configPath: string
  scenarios: ScenarioCase[]
}

interface ScenarioResult {
  scenario: string
  file: string
  outputFile: string
  samples: HmrProfileJsonSample[]
  averageMs: number
  maxMs: number
  averageBuildCoreMs?: number
  averageWatchToDirtyMs?: number
  averageTransformMs?: number
  averageWriteMs?: number
  averageEmitMs?: number
}

interface BenchmarkResult {
  name: string
  source: string
  startupMs: number
  scenarios: ScenarioResult[]
  averageMs: number
  maxMs: number
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const cliPath = path.join(repoRoot, 'packages/weapp-vite/bin/weapp-vite.js')
const reportRoot = path.join(repoRoot, '.tmp/template-hmr-bench')
const reportJsonPath = path.join(reportRoot, 'report.json')
const reportMdPath = path.join(reportRoot, 'report.md')
const tempConfigBackupName = '.weapp-vite.hmr-bench.original-config.ts'
const iterations = Number.parseInt(process.env.TEMPLATE_HMR_ITERATIONS ?? '3', 10)
const timeoutMs = Number.parseInt(process.env.TEMPLATE_HMR_TIMEOUT_MS ?? '30000', 10)
const heartbeatMs = Number.parseInt(process.env.TEMPLATE_HMR_HEARTBEAT_MS ?? '2000', 10)
const projectFilter = process.env.TEMPLATE_HMR_FILTER?.trim()
const debugEnabled = process.env.TEMPLATE_HMR_DEBUG === '1'

const PROJECTS: ProjectCase[] = [
  {
    id: 'e2e-apps/wevu-runtime-e2e',
    projectRoot: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e'),
    configPath: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/weapp-vite.config.ts'),
    appJsonTarget: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/app.json'),
    startupTarget: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/pages/hmr/index.wxml'),
    startupMarker: 'HMR',
    scenarios: [
      {
        id: 'native-template',
        label: 'native template',
        sourceFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/src/pages/hmr/index.wxml'),
        outputFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/pages/hmr/index.wxml'),
        mutate: (original, marker) => original.replace('HMR', marker),
      },
      {
        id: 'native-script',
        label: 'native script',
        sourceFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/src/pages/hmr/index.ts'),
        outputFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/pages/hmr/index.js'),
        mutate: (original, marker) => original.replace(`buildResult('hmr'`, `buildResult('${marker}'`),
      },
      {
        id: 'native-style',
        label: 'native style',
        sourceFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/src/pages/hmr/index.wxss'),
        outputFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/pages/hmr/index.wxss'),
        mutate: (original, marker) => `${stripTrailingMarker(original)}\n.hmr-bench-${toCssIdent(marker)} { color: #0f766e; }\n`,
      },
      {
        id: 'vue-template',
        label: 'vue template',
        sourceFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/src/pages/hmr-sfc/index.vue'),
        outputFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/pages/hmr-sfc/index.wxml'),
        mutate: (original, marker) => replaceHmrSfcTitle(original, marker),
      },
      {
        id: 'vue-script',
        label: 'vue script',
        sourceFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/src/pages/hmr-sfc/index.vue'),
        outputFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/pages/hmr-sfc/index.js'),
        mutate: (original, marker) => original.replace('HMR-SFC-SCRIPT', marker),
      },
      {
        id: 'vue-style',
        label: 'vue style',
        sourceFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/src/pages/hmr-sfc/index.vue'),
        outputFile: path.join(repoRoot, 'e2e-apps/wevu-runtime-e2e/dist/pages/hmr-sfc/index.wxss'),
        mutate: (original, marker) => original.replace('/* HMR-SFC-STYLE */', `.hmr-bench-${toCssIdent(marker)} { color: #1677ff; }`),
      },
    ],
  },
  {
    id: 'e2e-apps/github-issues',
    projectRoot: path.join(repoRoot, 'e2e-apps/github-issues'),
    configPath: path.join(repoRoot, 'e2e-apps/github-issues/weapp-vite.config.ts'),
    appJsonTarget: path.join(repoRoot, 'e2e-apps/github-issues/dist/app.json'),
    startupTarget: path.join(repoRoot, 'e2e-apps/github-issues/dist/pages/issue-398/index.wxml'),
    startupMarker: 'issue-398-page-initial',
    scenarios: [
      {
        id: 'layout-template',
        label: 'layout template',
        sourceFile: path.join(repoRoot, 'e2e-apps/github-issues/src/pages/issue-398/index.vue'),
        outputFile: path.join(repoRoot, 'e2e-apps/github-issues/dist/pages/issue-398/index.wxml'),
        mutate: (original, marker) => original.replace('issue-398-page-initial', marker),
      },
      {
        id: 'layout-script',
        label: 'layout script',
        sourceFile: path.join(repoRoot, 'e2e-apps/github-issues/src/pages/issue-398/index.vue'),
        outputFile: path.join(repoRoot, 'e2e-apps/github-issues/dist/pages/issue-398/index.js'),
        mutate: (original, marker) => original.replace('issue-398 hmr shared chunk', marker),
      },
      {
        id: 'layout-style',
        label: 'layout style',
        sourceFile: path.join(repoRoot, 'e2e-apps/github-issues/src/pages/issue-398/index.vue'),
        outputFile: path.join(repoRoot, 'e2e-apps/github-issues/dist/pages/issue-398/index.wxss'),
        mutate: (original, marker) => original.replace('</style>', `.issue-398-page__bench-${toCssIdent(marker)} { color: #52c41a; }\n</style>`),
      },
    ],
  },
  {
    id: 'e2e-apps/auto-routes-define-app-json',
    projectRoot: path.join(repoRoot, 'e2e-apps/auto-routes-define-app-json'),
    configPath: path.join(repoRoot, 'e2e-apps/auto-routes-define-app-json/weapp-vite.config.ts'),
    appJsonTarget: path.join(repoRoot, 'e2e-apps/auto-routes-define-app-json/dist/app.json'),
    startupTarget: path.join(repoRoot, 'e2e-apps/auto-routes-define-app-json/dist/pages/logs/index.wxml'),
    startupMarker: 'logs',
    scenarios: [
      {
        id: 'auto-routes-template',
        label: 'auto-routes template',
        sourceFile: path.join(repoRoot, 'e2e-apps/auto-routes-define-app-json/src/pages/logs/index.vue'),
        outputFile: path.join(repoRoot, 'e2e-apps/auto-routes-define-app-json/dist/pages/logs/index.wxml'),
        mutate: (original, marker) => original.replace('logs', marker),
      },
    ],
  },
] as const

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid TEMPLATE_HMR_ITERATIONS: ${String(process.env.TEMPLATE_HMR_ITERATIONS)}`)
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error(`Invalid TEMPLATE_HMR_TIMEOUT_MS: ${String(process.env.TEMPLATE_HMR_TIMEOUT_MS)}`)
}

if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0) {
  throw new Error(`Invalid TEMPLATE_HMR_HEARTBEAT_MS: ${String(process.env.TEMPLATE_HMR_HEARTBEAT_MS)}`)
}

async function main() {
  await mkdir(reportRoot, { recursive: true })
  await cleanupResidualDevProcesses()

  const selectedProjects = PROJECTS.filter(project => !projectFilter || project.id.includes(projectFilter))
  const results: BenchmarkResult[] = []

  for (const project of selectedProjects) {
    process.stdout.write(`\n[template-hmr] benchmarking ${project.id}\n`)
    results.push(await benchmarkProject(project))
  }

  const report = {
    generatedAt: new Date().toISOString(),
    iterations,
    timeoutMs,
    heartbeatMs,
    projects: results,
  }

  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(reportMdPath, renderMarkdown(results), 'utf8')

  process.stdout.write(`\n[template-hmr] report.json -> ${reportJsonPath}\n`)
  process.stdout.write(`[template-hmr] report.md -> ${reportMdPath}\n`)
}

async function benchmarkProject(project: ProjectCase): Promise<BenchmarkResult> {
  const profilePath = path.join(project.projectRoot, '.weapp-vite/hmr-profile.jsonl')
  const configBackupPath = path.join(project.projectRoot, tempConfigBackupName)
  const originalConfig = await readFile(project.configPath, 'utf8')
  const sourceBackups = new Map<string, string>()

  for (const scenario of project.scenarios) {
    if (!sourceBackups.has(scenario.sourceFile)) {
      sourceBackups.set(scenario.sourceFile, await readFile(scenario.sourceFile, 'utf8'))
    }
  }

  await writeBenchWrapperConfig(project.configPath, configBackupPath, originalConfig)
  await rm(path.join(project.projectRoot, 'dist'), { recursive: true, force: true }).catch(() => {})
  await rm(profilePath, { force: true }).catch(() => {})

  const dev = startDevProcess(process.execPath, [
    '--import',
    'tsx',
    cliPath,
    'dev',
    project.projectRoot,
    '--platform',
    'weapp',
    '--skipNpm',
  ], {
    cwd: project.projectRoot,
    env: createDevProcessEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
  })

  try {
    const startupStart = performance.now()
    const startupTouchFile = project.scenarios[0]!.sourceFile
    const startupTouchSource = sourceBackups.get(startupTouchFile)
    if (!startupTouchSource) {
      throw new Error(`Missing startup source backup for ${startupTouchFile}`)
    }
    debugLog(`${project.id}: waiting for ${normalizePath(project.appJsonTarget)}`)
    await dev.waitFor(
      waitForFileWithHeartbeat(project.appJsonTarget, startupTouchFile, startupTouchSource, 120_000),
      `${project.id} app.json generated`,
      120_000,
    )
    debugLog(`${project.id}: waiting for startup marker ${project.startupMarker}`)
    await dev.waitFor(
      waitForFileContainsWithHeartbeat(project.startupTarget, project.startupMarker, startupTouchFile, startupTouchSource, 120_000),
      `${project.id} startup target generated`,
      120_000,
    )
    const startupMs = performance.now() - startupStart
    debugLog(`${project.id}: initial build ready in ${startupMs.toFixed(2)}ms`)

    const scenarioResults: ScenarioResult[] = []
    for (const scenario of project.scenarios) {
      scenarioResults.push(await benchmarkScenario({
        projectId: project.id,
        profilePath,
        scenario,
      }))
    }

    const totalValues = scenarioResults.flatMap(item => item.samples.map(sample => sample.totalMs ?? 0))
    return {
      name: project.id,
      source: normalizePath(path.relative(repoRoot, project.projectRoot)),
      startupMs,
      scenarios: scenarioResults,
      averageMs: average(totalValues),
      maxMs: max(totalValues),
    }
  }
  finally {
    await dev.stop(5_000).catch(() => {})
    for (const [filePath, original] of sourceBackups) {
      await writeFile(filePath, original, 'utf8').catch(() => {})
    }
    await writeFile(project.configPath, originalConfig, 'utf8').catch(() => {})
    await rm(configBackupPath, { force: true }).catch(() => {})
  }
}

async function benchmarkScenario(options: {
  projectId: string
  profilePath: string
  scenario: ScenarioCase
}): Promise<ScenarioResult> {
  const { projectId, profilePath, scenario } = options
  const original = await readFile(scenario.sourceFile, 'utf8')
  const samples: HmrProfileJsonSample[] = []

  for (let index = 0; index < iterations; index += 1) {
    const marker = createMarker(projectId, scenario.id, index)
    const profileLineCount = await countJsonlLines(profilePath)
    const current = scenario.mutate(original, marker)
    debugLog(`scenario=${scenario.id} iteration=${index + 1}: mutate ${normalizePath(scenario.sourceFile)}`)
    await replaceFileByRename(scenario.sourceFile, current)
    await waitForFileContainsWithHeartbeat(scenario.outputFile, marker, scenario.sourceFile, current)
    samples.push(await waitForHmrProfileSample(profilePath, scenario.sourceFile, profileLineCount))
  }

  await replaceFileByRename(scenario.sourceFile, original)

  return {
    scenario: scenario.label,
    file: normalizePath(scenario.sourceFile),
    outputFile: normalizePath(scenario.outputFile),
    samples,
    averageMs: average(samples.map(sample => sample.totalMs ?? 0)),
    maxMs: max(samples.map(sample => sample.totalMs ?? 0)),
    averageBuildCoreMs: averageOptional(samples.map(sample => sample.buildCoreMs)),
    averageWatchToDirtyMs: averageOptional(samples.map(sample => sample.watchToDirtyMs)),
    averageTransformMs: averageOptional(samples.map(sample => sample.transformMs)),
    averageWriteMs: averageOptional(samples.map(sample => sample.writeMs)),
    averageEmitMs: averageOptional(samples.map(sample => sample.emitMs)),
  }
}

async function waitForFile(filePath: string, waitMs = timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    if (await pathExists(filePath)) {
      return
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for file: ${filePath}`)
}

async function waitForFileWithHeartbeat(
  filePath: string,
  touchFilePath: string,
  targetSource: string,
  waitMs = timeoutMs,
) {
  const deadline = Date.now() + waitMs
  let nextHeartbeatAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      await waitForFile(filePath, 1_000)
      return
    }
    catch {
      if (Date.now() >= nextHeartbeatAt) {
        debugLog(`startup heartbeat ${normalizePath(touchFilePath)}`)
        await replaceFileByRename(touchFilePath, targetSource)
        nextHeartbeatAt = Date.now() + heartbeatMs
      }
    }
  }

  await waitForFile(filePath, 1_000)
}

async function waitForFileContainsWithHeartbeat(
  filePath: string,
  marker: string,
  touchFilePath: string,
  targetSource: string,
  waitMs = timeoutMs,
) {
  const deadline = Date.now() + waitMs
  let nextHeartbeatAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      await waitForFileContains(filePath, marker, 1_000)
      return
    }
    catch {
      if (Date.now() >= nextHeartbeatAt) {
        debugLog(`heartbeat ${normalizePath(touchFilePath)}`)
        await replaceFileByRename(touchFilePath, targetSource)
        nextHeartbeatAt = Date.now() + heartbeatMs
      }
    }
  }

  await waitForFileContains(filePath, marker, 1_000)
}

async function waitForFileContains(filePath: string, marker: string, waitMs = timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    if (await pathExists(filePath)) {
      const content = await readFile(filePath, 'utf8')
      if (content.includes(marker)) {
        return
      }
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${filePath} to contain marker: ${marker}`)
}

async function waitForHmrProfileSample(profilePath: string, sourceFile: string, startLineCount: number) {
  const startedAt = Date.now()
  const normalizedSourceFile = normalizePath(sourceFile)

  while (Date.now() - startedAt < timeoutMs) {
    const samples = await readJsonlSamplesSince(profilePath, startLineCount)
    const matched = samples.findLast(sample => normalizePath(sample.file) === normalizedSourceFile)
    if (matched) {
      return matched
    }
    await sleep(250)
  }

  return {
    file: normalizedSourceFile,
  } satisfies HmrProfileJsonSample
}

async function countJsonlLines(filePath: string) {
  if (!(await pathExists(filePath))) {
    return 0
  }
  const content = await readFile(filePath, 'utf8')
  return content
    .split('\n')
    .filter(line => line.trim().length > 0)
    .length
}

async function readJsonlSamplesSince(filePath: string, startLineCount: number) {
  if (!(await pathExists(filePath))) {
    return []
  }
  const content = await readFile(filePath, 'utf8')
  return content
    .split('\n')
    .filter(line => line.trim().length > 0)
    .slice(startLineCount)
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

async function writeBenchWrapperConfig(filePath: string, backupPath: string, originalConfig: string) {
  const source = [
    `import { defineConfig } from 'weapp-vite'`,
    `import originalConfig from './${path.basename(backupPath)}'`,
    ``,
    `export default defineConfig(async (env) => {`,
    `  const resolved = typeof originalConfig === 'function' ? await originalConfig(env) : await originalConfig`,
    `  return {`,
    `    ...resolved,`,
    `    weapp: {`,
    `      ...(resolved?.weapp ?? {}),`,
    `      hmr: {`,
    `        ...(resolved?.weapp?.hmr ?? {}),`,
    `        logLevel: 'verbose',`,
    `        profileJson: true,`,
    `      },`,
    `    },`,
    `  }`,
    `})`,
    ``,
  ].join('\n')

  await writeFile(backupPath, originalConfig, 'utf8')
  await writeFile(filePath, source, 'utf8')
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

function createMarker(projectId: string, scenarioId: string, index: number) {
  return `${toUpperIdent(projectId)}-${toUpperIdent(scenarioId)}-${index + 1}`
}

function normalizePath(value: string | undefined) {
  return (value ?? '').replaceAll('\\', '/')
}

function stripTrailingMarker(source: string) {
  return source
    .replace(/\n?const __hmrBenchScriptMarker = '.*?'\n?$/g, '\n')
    .replace(/\n?\.hmr-bench-[a-z0-9-]+ \{ color: #[0-9a-f]{6}; \}\n?$/gi, '\n')
    .replace(/\n{3,}$/g, '\n\n')
    .trimEnd()
}

function toUpperIdent(value: string) {
  return value
    .replaceAll(/[^a-z0-9]+/gi, '-')
    .replaceAll(/^-+|-+$/g, '')
    .toUpperCase()
}

function toCssIdent(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageOptional(values: Array<number | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (filtered.length === 0) {
    return undefined
  }
  return average(filtered)
}

function max(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return Math.max(...values)
}

function formatMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${value.toFixed(2)} ms`
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function debugLog(message: string) {
  if (!debugEnabled) {
    return
  }
  process.stdout.write(`[template-hmr:debug] ${message}\n`)
}

function renderMarkdown(results: BenchmarkResult[]) {
  const lines = [
    '# HMR Benchmark',
    '',
    '> 基于已验证可工作的 e2e HMR fixture 采样，不修改 tracked 模板文件。',
    '',
    `- generatedAt: ${new Date().toISOString()}`,
    `- iterations: ${iterations}`,
    `- timeoutMs: ${timeoutMs}`,
    `- heartbeatMs: ${heartbeatMs}`,
    '',
    '| project | startup | avg hmr | max hmr | slowest scenario |',
    '| --- | ---: | ---: | ---: | --- |',
  ]

  for (const item of results) {
    const slowestScenario = [...item.scenarios].sort((left, right) => right.averageMs - left.averageMs)[0]
    lines.push(
      `| ${item.name} | ${formatMs(item.startupMs)} | ${formatMs(item.averageMs)} | ${formatMs(item.maxMs)} | ${slowestScenario?.scenario ?? '-'} |`,
    )
  }

  for (const item of results) {
    lines.push('')
    lines.push(`## ${item.name}`)
    lines.push('')
    lines.push(`- source: ${item.source}`)
    lines.push(`- startup: ${formatMs(item.startupMs)}`)
    lines.push('')
    lines.push('| scenario | avg total | max total | avg build-core | avg watch->dirty | avg transform | avg write | avg emit |')
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
    for (const scenario of item.scenarios) {
      lines.push(
        `| ${scenario.scenario} | ${formatMs(scenario.averageMs)} | ${formatMs(scenario.maxMs)} | ${formatMs(scenario.averageBuildCoreMs)} | ${formatMs(scenario.averageWatchToDirtyMs)} | ${formatMs(scenario.averageTransformMs)} | ${formatMs(scenario.averageWriteMs)} | ${formatMs(scenario.averageEmitMs)} |`,
      )
    }
  }

  return `${lines.join('\n')}\n`
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
