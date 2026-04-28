/* eslint-disable ts/no-use-before-define */
import { createHash } from 'node:crypto'
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { startDevProcess } from '../e2e/utils/dev-process'
import { cleanupResidualDevProcesses } from '../e2e/utils/dev-process-cleanup'
import { createDevProcessEnv } from '../e2e/utils/dev-process-env'
import { replaceFileByRename } from '../e2e/utils/hmr-helpers'

interface HmrProfileJsonSample {
  timestamp?: string
  totalMs?: number
  event?: string
  file?: string
  buildCoreMs?: number
  transformMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
}

interface DistFileSnapshot {
  hash: string
  size: number
}

interface ImpactFile {
  path: string
  status: 'added' | 'modified' | 'removed'
  sizeBefore?: number
  sizeAfter?: number
}

interface ScenarioCase {
  id: string
  label: string
  sourceRel: string
  baselineMarker: string
  expectedMarker?: (marker: string) => string
  wait: (marker: string) => WaitTarget
  mutate: (source: string, marker: string) => string
}

type WaitTarget
  = | { kind: 'file', distRel: string, marker: string }
    | { kind: 'dist', marker: string }

interface ScenarioSample {
  iteration: number
  marker: string
  totalMs: number
  profile?: HmrProfileJsonSample
  impact: ImpactFile[]
  impactCount: number
  matchedOutput?: string
}

interface ScenarioResult {
  id: string
  label: string
  source: string
  samples: ScenarioSample[]
  averageMs?: number
  maxMs?: number
  averageBuildCoreMs?: number
  averageWatchToDirtyMs?: number
  averageTransformMs?: number
  averageWriteMs?: number
  averageEmitMs?: number
  averageImpactCount?: number
  error?: string
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appRoot = path.join(repoRoot, 'apps/hmr-lab')
const distRoot = path.join(appRoot, 'dist')
const profilePath = path.join(appRoot, '.weapp-vite/hmr-profile.jsonl')
const cliPath = path.join(repoRoot, 'packages/weapp-vite/bin/weapp-vite.js')
const reportRoot = path.resolve(process.env.HMR_LAB_REPORT_DIR ?? path.join(repoRoot, '.tmp/hmr-lab'))
const reportJsonPath = path.join(reportRoot, 'report.json')
const reportMdPath = path.join(reportRoot, 'report.md')
const iterations = readPositiveIntegerEnv('HMR_LAB_ITERATIONS', 2)
const timeoutMs = readPositiveIntegerEnv('HMR_LAB_TIMEOUT_MS', 30_000)
const filter = process.env.HMR_LAB_FILTER?.trim()
const failOnError = process.env.HMR_LAB_FAIL_ON_ERROR === '1'
const SCENARIOS: ScenarioCase[] = [
  createReplaceScenario('app-json', 'app.json', 'src/app.json', 'HMR_LAB_APP_JSON_MARKER', fileWait('app.json')),
  createReplaceScenario('app-wxss', 'app.wxss', 'src/app.wxss', 'app-style-marker', fileWait('app.wxss'), cssExpected),
  createReplaceScenario('app-script', 'app.ts', 'src/app.ts', 'APP_SCRIPT_MARKER', fileWait('app.js')),
  createReplaceScenario('native-template', 'native page wxml', 'src/pages/native/index.wxml', 'NATIVE_TEMPLATE_MARKER', fileWait('pages/native/index.wxml')),
  createReplaceScenario('native-style', 'native page wxss', 'src/pages/native/index.wxss', 'native-style-marker', fileWait('pages/native/index.wxss'), cssExpected),
  createReplaceScenario('native-script', 'native page ts', 'src/pages/native/index.ts', 'NATIVE_SCRIPT_MARKER', fileWait('pages/native/index.js')),
  createReplaceScenario('native-json', 'native page json', 'src/pages/native/index.json', 'NATIVE_JSON_MARKER', fileWait('pages/native/index.json')),
  createReplaceScenario('component-template', 'component wxml', 'src/components/probe-card/index.wxml', 'COMP_TEMPLATE_MARKER', fileWait('components/probe-card/index.wxml')),
  createReplaceScenario('component-style', 'component wxss', 'src/components/probe-card/index.wxss', 'probe-card-style-marker', fileWait('components/probe-card/index.wxss'), cssExpected),
  createReplaceScenario('component-script', 'component ts', 'src/components/probe-card/index.ts', 'COMP_SCRIPT_MARKER', fileWait('components/probe-card/index.js')),
  createReplaceScenario('component-json', 'component json', 'src/components/probe-card/index.json', 'COMP_JSON_MARKER', fileWait('components/probe-card/index.json')),
  createReplaceScenario('sfc-template', 'Vue SFC template', 'src/pages/sfc/index.vue', 'SFC_TEMPLATE_MARKER', fileWait('pages/sfc/index.wxml')),
  createReplaceScenario('sfc-script', 'Vue SFC script', 'src/pages/sfc/index.vue', 'SFC_SCRIPT_MARKER', fileWait('pages/sfc/index.js')),
  createReplaceScenario('sfc-style', 'Vue SFC style', 'src/pages/sfc/index.vue', 'sfc-style-marker', fileWait('pages/sfc/index.wxss'), cssExpected),
  createReplaceScenario('html-template', 'HTML template', 'src/pages/html/index.html', 'HTML_TEMPLATE_MARKER', fileWait('pages/html/index.wxml')),
  createReplaceScenario('shared-ts', 'shared TypeScript dependency', 'src/shared/tokens.ts', 'SHARED_TOKEN_MARKER', distWait),
  createReplaceScenario('shared-scss', 'shared SCSS dependency', 'src/shared/styles/shared.scss', 'shared-style-marker', distWait, cssExpected),
  createReplaceScenario('shared-template-import', 'shared imported WXML template', 'src/shared/templates/card.wxml', 'SHARED_TEMPLATE_MARKER', fileWait('shared/templates/card.wxml')),
  createReplaceScenario('shared-template-include', 'shared included WXML partial', 'src/shared/templates/partial.wxml', 'SHARED_INCLUDE_MARKER', fileWait('shared/templates/partial.wxml')),
  createReplaceScenario('shared-wxs', 'shared WXS dependency', 'src/shared/wxs/format.wxs', 'SHARED_WXS_MARKER', fileWait('shared/wxs/format.wxs')),
  createReplaceScenario('subpackage-template', 'subpackage wxml', 'src/subpackages/lab/pages/sub-native/index.wxml', 'SUB_TEMPLATE_MARKER', fileWait('subpackages/lab/pages/sub-native/index.wxml')),
  createReplaceScenario('subpackage-style', 'subpackage wxss', 'src/subpackages/lab/pages/sub-native/index.wxss', 'sub-style-marker', fileWait('subpackages/lab/pages/sub-native/index.wxss'), cssExpected),
  createReplaceScenario('subpackage-script', 'subpackage ts', 'src/subpackages/lab/pages/sub-native/index.ts', 'SUB_SCRIPT_MARKER', fileWait('subpackages/lab/pages/sub-native/index.js')),
  createReplaceScenario('subpackage-json', 'subpackage json', 'src/subpackages/lab/pages/sub-native/index.json', 'SUB_JSON_MARKER', fileWait('subpackages/lab/pages/sub-native/index.json')),
]

async function main() {
  await mkdir(reportRoot, { recursive: true })
  await cleanupResidualDevProcesses()
  await rm(distRoot, { recursive: true, force: true })
  await rm(profilePath, { force: true })

  const selectedScenarios = SCENARIOS.filter(scenario => !filter || scenario.id.includes(filter) || scenario.label.includes(filter))
  const backups = new Map<string, string>()
  for (const scenario of selectedScenarios) {
    const sourcePath = path.join(appRoot, scenario.sourceRel)
    if (!backups.has(sourcePath)) {
      backups.set(sourcePath, await readFile(sourcePath, 'utf8'))
    }
  }

  const dev = startDevProcess(process.execPath, [
    cliPath,
    'dev',
    'apps/hmr-lab',
    '--platform',
    'weapp',
    '--skipNpm',
  ], {
    cwd: repoRoot,
    env: createDevProcessEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
  })

  try {
    const startupStart = performance.now()
    await dev.waitFor(waitForFile(path.join(distRoot, 'app.json'), 120_000), 'hmr-lab app.json generated', 120_000)
    await dev.waitFor(waitForTarget(SCENARIOS[0]!.wait(SCENARIOS[0]!.baselineMarker), 120_000), 'hmr-lab initial output generated', 120_000)
    const startupMs = performance.now() - startupStart

    const results: ScenarioResult[] = []
    for (const scenario of selectedScenarios) {
      process.stdout.write(`[hmr-lab] ${scenario.id}\n`)
      results.push(await runScenario(scenario))
    }

    const report = {
      generatedAt: new Date().toISOString(),
      app: 'apps/hmr-lab',
      iterations,
      timeoutMs,
      startupMs,
      scenarios: results,
    }
    await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(reportMdPath, renderMarkdown(report), 'utf8')
    const failures = results.filter(result => result.error)
    process.stdout.write(`\n[hmr-lab] report.json -> ${formatReportPath(reportJsonPath)}\n`)
    process.stdout.write(`[hmr-lab] report.md -> ${formatReportPath(reportMdPath)}\n`)
    if (failures.length) {
      process.stdout.write(`[hmr-lab] failed scenarios: ${failures.map(result => result.id).join(', ')}\n`)
      if (failOnError) {
        process.exitCode = 1
      }
    }
  }
  finally {
    await dev.stop(5_000).catch(() => {})
    for (const [sourcePath, original] of backups) {
      await writeFile(sourcePath, original, 'utf8').catch(() => {})
    }
    await cleanupResidualDevProcesses()
  }
}

async function runScenario(scenario: ScenarioCase): Promise<ScenarioResult> {
  const sourcePath = path.join(appRoot, scenario.sourceRel)
  const original = await readFile(sourcePath, 'utf8')
  const samples: ScenarioSample[] = []

  try {
    for (let index = 0; index < iterations; index += 1) {
      const marker = createMarker(scenario.id, index)
      const expectedMarker = scenario.expectedMarker?.(marker) ?? marker
      const updated = scenario.mutate(original, marker)
      if (updated === original) {
        throw new Error(`Scenario ${scenario.id} did not change source.`)
      }

      const lineCount = await countJsonlLines(profilePath)
      const before = await snapshotDist()
      const startedAt = performance.now()
      await replaceFileByRename(sourcePath, updated)
      const matchedOutput = await waitForTarget(scenario.wait(expectedMarker), timeoutMs)
      await sleep(250)
      const after = await snapshotDist()
      const totalMs = performance.now() - startedAt
      const profile = await waitForHmrProfileSample(sourcePath, lineCount, 2_000)
      const impact = diffDistSnapshots(before, after)

      samples.push({
        iteration: index + 1,
        marker,
        totalMs: profile?.totalMs ?? totalMs,
        profile,
        impact,
        impactCount: impact.length,
        matchedOutput,
      })
    }
  }
  catch (error) {
    return {
      id: scenario.id,
      label: scenario.label,
      source: scenario.sourceRel,
      samples,
      error: error instanceof Error ? error.message : String(error),
    }
  }
  finally {
    await replaceFileByRename(sourcePath, original).catch(() => {})
    await waitForTarget(scenario.wait(scenario.baselineMarker), timeoutMs).catch(() => {})
  }

  return {
    id: scenario.id,
    label: scenario.label,
    source: scenario.sourceRel,
    samples,
    averageMs: average(samples.map(sample => sample.totalMs)),
    maxMs: max(samples.map(sample => sample.totalMs)),
    averageBuildCoreMs: averageOptional(samples.map(sample => sample.profile?.buildCoreMs)),
    averageWatchToDirtyMs: averageOptional(samples.map(sample => sample.profile?.watchToDirtyMs)),
    averageTransformMs: averageOptional(samples.map(sample => sample.profile?.transformMs)),
    averageWriteMs: averageOptional(samples.map(sample => sample.profile?.writeMs)),
    averageEmitMs: averageOptional(samples.map(sample => sample.profile?.emitMs)),
    averageImpactCount: average(samples.map(sample => sample.impactCount)),
  }
}

function createReplaceScenario(
  id: string,
  label: string,
  sourceRel: string,
  baselineMarker: string,
  waitFactory: (marker: string) => WaitTarget,
  expectedMarker?: (marker: string) => string,
): ScenarioCase {
  return {
    id,
    label,
    sourceRel,
    baselineMarker,
    expectedMarker,
    wait: waitFactory,
    mutate: (source, marker) => {
      const replacement = expectedMarker ? expectedMarker(marker) : marker
      return source.replace(baselineMarker, replacement)
    },
  }
}

function fileWait(distRel: string) {
  return (marker: string): WaitTarget => ({
    kind: 'file',
    distRel,
    marker,
  })
}

function distWait(marker: string): WaitTarget {
  return {
    kind: 'dist',
    marker,
  }
}

function cssExpected(marker: string) {
  return toCssIdent(marker)
}

async function waitForTarget(target: WaitTarget, waitMs = timeoutMs) {
  if (target.kind === 'file') {
    const filePath = path.join(distRoot, target.distRel)
    await waitForFileContains(filePath, target.marker, waitMs)
    return target.distRel
  }
  return await waitForDistContains(target.marker, waitMs)
}

async function waitForFile(filePath: string, waitMs = timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    if (await pathExists(filePath)) {
      return
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for file: ${formatReportPath(filePath)}`)
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
  throw new Error(`Timed out waiting for ${formatReportPath(filePath)} to contain marker: ${marker}`)
}

async function waitForDistContains(marker: string, waitMs = timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    const matched = await findDistFileContains(marker)
    if (matched) {
      return matched
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for dist to contain marker: ${marker}`)
}

async function findDistFileContains(marker: string) {
  for (const filePath of await listFiles(distRoot)) {
    const content = await readFile(filePath, 'utf8').catch(() => '')
    if (content.includes(marker)) {
      return normalizePath(path.relative(distRoot, filePath))
    }
  }
  return undefined
}

async function snapshotDist() {
  const snapshot = new Map<string, DistFileSnapshot>()
  for (const filePath of await listFiles(distRoot)) {
    const fileStat = await stat(filePath)
    const content = await readFile(filePath)
    const relative = normalizePath(path.relative(distRoot, filePath))
    snapshot.set(relative, {
      hash: createHash('sha1').update(content).digest('hex'),
      size: fileStat.size,
    })
  }
  return snapshot
}

function diffDistSnapshots(before: Map<string, DistFileSnapshot>, after: Map<string, DistFileSnapshot>) {
  const result: ImpactFile[] = []
  for (const [filePath, afterFile] of after) {
    const beforeFile = before.get(filePath)
    if (!beforeFile) {
      result.push({ path: filePath, status: 'added', sizeAfter: afterFile.size })
    }
    else if (beforeFile.hash !== afterFile.hash) {
      result.push({ path: filePath, status: 'modified', sizeBefore: beforeFile.size, sizeAfter: afterFile.size })
    }
  }
  for (const [filePath, beforeFile] of before) {
    if (!after.has(filePath)) {
      result.push({ path: filePath, status: 'removed', sizeBefore: beforeFile.size })
    }
  }
  return result.sort((left, right) => left.path.localeCompare(right.path))
}

async function listFiles(root: string) {
  if (!(await pathExists(root))) {
    return []
  }
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const current = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(current))
    }
    else if (entry.isFile()) {
      files.push(current)
    }
  }
  return files
}

async function waitForHmrProfileSample(sourcePath: string, startLineCount: number, waitMs: number) {
  const startedAt = Date.now()
  const normalizedSource = normalizePath(sourcePath)
  while (Date.now() - startedAt < waitMs) {
    const samples = await readJsonlSamplesSince(startLineCount)
    const matched = samples.findLast(sample => normalizePath(sample.file) === normalizedSource)
    if (matched) {
      return formatProfileSample(matched)
    }
    const latest = samples.at(-1)
    if (latest) {
      return formatProfileSample(latest)
    }
    await sleep(250)
  }
  return undefined
}

async function readJsonlSamplesSince(startLineCount: number) {
  if (!(await pathExists(profilePath))) {
    return []
  }
  const content = await readFile(profilePath, 'utf8')
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

function formatProfileSample(sample: HmrProfileJsonSample): HmrProfileJsonSample {
  return {
    ...sample,
    file: formatReportPath(sample.file),
  }
}

async function countJsonlLines(filePath: string) {
  if (!(await pathExists(filePath))) {
    return 0
  }
  const content = await readFile(filePath, 'utf8')
  return content.split('\n').filter(line => line.trim().length > 0).length
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

function renderMarkdown(report: {
  generatedAt: string
  app: string
  iterations: number
  timeoutMs: number
  startupMs: number
  scenarios: ScenarioResult[]
}) {
  const lines = [
    '# HMR Lab Report',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- app: ${report.app}`,
    `- startup: ${formatMs(report.startupMs)}`,
    `- iterations: ${report.iterations}`,
    `- timeoutMs: ${report.timeoutMs}`,
    '',
    '| scenario | source | avg total | max total | avg watch->dirty | avg transform | avg write | avg emit | avg impact | status |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ]

  for (const scenario of report.scenarios) {
    lines.push([
      scenario.id,
      scenario.source,
      formatMs(scenario.averageMs),
      formatMs(scenario.maxMs),
      formatMs(scenario.averageWatchToDirtyMs),
      formatMs(scenario.averageTransformMs),
      formatMs(scenario.averageWriteMs),
      formatMs(scenario.averageEmitMs),
      formatNumber(scenario.averageImpactCount),
      scenario.error ? `failed: ${escapeTable(scenario.error)}` : 'ok',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  for (const scenario of report.scenarios) {
    lines.push('')
    lines.push(`## ${scenario.id}`)
    lines.push('')
    lines.push(`- label: ${scenario.label}`)
    lines.push(`- source: ${scenario.source}`)
    if (scenario.error) {
      lines.push(`- error: ${scenario.error}`)
    }
    lines.push('')
    lines.push('| run | total | profile file | dirty/pending/emitted | changed outputs | sample impact |')
    lines.push('| ---: | ---: | --- | --- | ---: | --- |')
    for (const sample of scenario.samples) {
      lines.push([
        String(sample.iteration),
        formatMs(sample.totalMs),
        sample.profile?.file ?? '-',
        `${sample.profile?.dirtyCount ?? '-'}/${sample.profile?.pendingCount ?? '-'}/${sample.profile?.emittedCount ?? '-'}`,
        String(sample.impactCount),
        escapeTable(sample.impact.slice(0, 6).map(item => `${item.status}:${item.path}`).join('<br>') || '-'),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
  }

  return `${lines.join('\n')}\n`
}

function createMarker(scenarioId: string, index: number) {
  return `HMR_LAB_${toUpperIdent(scenarioId)}_${index + 1}`
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${raw}`)
  }
  return value
}

function average(values: number[]) {
  if (values.length === 0) {
    return undefined
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageOptional(values: Array<number | undefined>) {
  return average(values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))
}

function max(values: number[]) {
  if (values.length === 0) {
    return undefined
  }
  return Math.max(...values)
}

function formatMs(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} ms` : '-'
}

function formatNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-'
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

function normalizePath(value: string | undefined) {
  return (value ?? '').replaceAll('\\', '/')
}

function toUpperIdent(value: string) {
  return value.replaceAll(/[^a-z0-9]+/gi, '_').replaceAll(/^_+|_+$/g, '').toUpperCase()
}

function toCssIdent(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
}

function escapeTable(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
