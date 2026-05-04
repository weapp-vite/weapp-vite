/* eslint-disable ts/no-use-before-define */
import type { WorkspaceHmrBaseline } from './workspace-hmr/baseline'
import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { access, appendFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { startDevProcess } from '../e2e/utils/dev-process'
import { cleanupResidualDevProcesses } from '../e2e/utils/dev-process-cleanup'
import { createDevProcessEnv } from '../e2e/utils/dev-process-env'
import { replaceFileByRename } from '../e2e/utils/hmr-helpers'
import {
  createWorkspaceHmrBaseline,
  evaluateWorkspaceHmrThresholds,
  parseThresholdOverrides,
  renderThresholdMarkdown,
} from './workspace-hmr/baseline'

const execFile = promisify(execFileCallback)

interface PackageJson {
  name?: string
  scripts?: Record<string, string>
}

interface ProjectCase {
  id: string
  kind: 'apps' | 'templates' | 'e2e-apps'
  root: string
  distRoot: string
  sourceRoot: string
  platform: RuntimePlatform
}

type RuntimePlatform = 'weapp' | 'alipay'
type WorkspaceHmrRunMode = 'full' | 'smoke' | 'changed-project' | 'nightly-full'

interface ScenarioCase {
  id: string
  label: string
  sourcePath: string
  outputPath: string
  expectedMarker?: (marker: string) => string
  mutate: (source: string, marker: string) => string
}

interface HmrProfileSample {
  timestamp?: string
  totalMs?: number
  eventId?: string
  event?: string
  file?: string
  relativeFile?: string
  sourceRootFile?: string
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

interface ScenarioResult {
  id: string
  label: string
  source: string
  output: string
  marker?: string
  totalMs?: number
  observedMs?: number
  profile?: HmrProfileSample
  impact?: ImpactFile[]
  error?: string
}

interface ProjectResult {
  id: string
  kind: ProjectCase['kind']
  platform: RuntimePlatform
  source: string
  startupMs?: number
  scenarios: ScenarioResult[]
  error?: string
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const cliPath = path.join(repoRoot, 'packages/weapp-vite/bin/weapp-vite.js')
const reportRoot = path.resolve(process.env.WORKSPACE_HMR_REPORT_DIR ?? path.join(repoRoot, '.tmp/workspace-hmr'))
const reportJsonPath = path.join(reportRoot, 'report.json')
const reportMdPath = path.join(reportRoot, 'report.md')
const thresholdMdPath = path.join(reportRoot, 'thresholds.md')
const baselinePath = path.resolve(process.env.WORKSPACE_HMR_BASELINE_PATH ?? path.join(repoRoot, 'scripts/workspace-hmr/templates-baseline.json'))
const projectFilter = process.env.WORKSPACE_HMR_FILTER?.trim()
const failOnError = process.env.WORKSPACE_HMR_FAIL_ON_ERROR === '1'
const writeBaseline = process.env.WORKSPACE_HMR_WRITE_BASELINE === '1'
const runMode = readRunMode(process.env.WORKSPACE_HMR_MODE)
const startupTimeoutMs = readPositiveIntegerEnv('WORKSPACE_HMR_STARTUP_TIMEOUT_MS', 90_000)
const scenarioTimeoutMs = readPositiveIntegerEnv('WORKSPACE_HMR_TIMEOUT_MS', 30_000)
const settleMs = readPositiveIntegerEnv('WORKSPACE_HMR_SETTLE_MS', 250)
const maxScenariosPerProject = readOptionalPositiveIntegerEnv('WORKSPACE_HMR_MAX_SCENARIOS_PER_PROJECT') ?? (runMode === 'smoke' ? 1 : undefined)
const ROOTS = ['apps', 'templates', 'e2e-apps'] as const
const PLATFORM_EXT: Record<RuntimePlatform, { template: string, style: string }> = {
  weapp: { template: 'wxml', style: 'wxss' },
  alipay: { template: 'axml', style: 'acss' },
}
const SOURCE_DIRS = ['src', 'miniprogram', '.'] as const
const WORKSPACE_HMR_IMPACT_PATH_PREFIXES = [
  '@weapp-core/',
  'packages/weapp-vite/src/',
  'packages/rolldown-require/src/',
  'packages-runtime/weapi/src/',
  'packages-runtime/web/src/',
  'packages-runtime/web-apis/src/',
  'packages-runtime/wevu/src/',
  'packages-runtime/wevu-compiler/src/',
]
const WORKSPACE_HMR_IMPACT_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'scripts/workspace-hmr/templates-baseline.json',
])
const SKIPPED_PROJECT_IDS = new Set([
  'apps/api-extractor-vue-types-demo',
  'apps/playground',
  'apps/raw-ts',
  'apps/rollup-watcher',
  'e2e-apps/script-setup-macros-js-with-defaults-invalid',
])

async function main() {
  await mkdir(reportRoot, { recursive: true })
  await cleanupResidualDevProcesses()

  const projects = (await selectProjectsForRunMode(await discoverProjects()))
    .filter(project => !projectFilter || project.id.includes(projectFilter))

  const results: ProjectResult[] = []
  for (const project of projects) {
    process.stdout.write(`[workspace-hmr] ${project.id}\n`)
    results.push(await auditProject(project))
  }

  const generatedAt = new Date().toISOString()
  let baseline = await readWorkspaceHmrBaseline(baselinePath)
  if (writeBaseline) {
    baseline = createWorkspaceHmrBaseline(results, {
      generatedAt,
      mode: 'templates-baseline',
      scope: 'templates',
      thresholds: baseline?.thresholds,
    })
    await mkdir(path.dirname(baselinePath), { recursive: true })
    await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    process.stdout.write(`[workspace-hmr] baseline -> ${formatReportPath(baselinePath)}\n`)
  }
  const thresholdEvaluation = evaluateWorkspaceHmrThresholds(results, {
    baseline,
    overrides: parseThresholdOverrides(process.env),
  })
  const thresholdMarkdown = renderThresholdMarkdown(thresholdEvaluation)
  const report = {
    generatedAt,
    mode: runMode,
    baseline: baseline ? formatReportPath(baselinePath) : undefined,
    startupTimeoutMs,
    scenarioTimeoutMs,
    settleMs,
    maxScenariosPerProject,
    projects: results,
    thresholds: thresholdEvaluation,
  }
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(thresholdMdPath, `${thresholdMarkdown}\n`, 'utf8')
  await writeFile(reportMdPath, renderMarkdown(results, thresholdMarkdown), 'utf8')
  await writeGitHubStepSummary(results, thresholdMarkdown)

  const failedProjects = results.filter(project => project.error || project.scenarios.some(scenario => scenario.error))
  process.stdout.write(`\n[workspace-hmr] report.json -> ${formatReportPath(reportJsonPath)}\n`)
  process.stdout.write(`[workspace-hmr] report.md -> ${formatReportPath(reportMdPath)}\n`)
  process.stdout.write(`[workspace-hmr] thresholds.md -> ${formatReportPath(thresholdMdPath)}\n`)
  if (thresholdEvaluation.issues.length) {
    process.stdout.write(`[workspace-hmr] threshold issues: ${thresholdEvaluation.issues.length}\n`)
    process.stdout.write(`\n${thresholdMarkdown}\n`)
  }
  if (failedProjects.length) {
    process.stdout.write(`[workspace-hmr] failed projects: ${failedProjects.map(project => project.id).join(', ')}\n`)
  }
  if (failOnError && (failedProjects.length || thresholdEvaluation.issues.length)) {
    process.exitCode = 1
  }
}

async function selectProjectsForRunMode(projects: ProjectCase[]) {
  if (runMode === 'smoke') {
    return selectSmokeProjects(projects)
  }
  if (runMode === 'changed-project') {
    const changedFiles = await readChangedFiles()
    const projectIds = resolveChangedProjectIds(changedFiles)
    const selected = projects.filter(project => projectIds.has(project.id))
    if (selected.length) {
      process.stdout.write(`[workspace-hmr] changed projects: ${selected.map(project => project.id).join(', ')}\n`)
      return selected
    }
    if (shouldFallbackToSmokeForChangedFiles(changedFiles)) {
      process.stdout.write('[workspace-hmr] no changed runnable projects detected; falling back to smoke templates\n')
      return selectSmokeProjects(projects)
    }
    process.stdout.write('[workspace-hmr] no workspace HMR relevant changes detected; skipping audit\n')
    return []
  }
  return projects
}

export function shouldFallbackToSmokeForChangedFiles(changedFiles: string[]) {
  if (!changedFiles.length) {
    return true
  }
  return changedFiles.some(file => !isWorkspaceHmrIgnoredChange(file) && (
    WORKSPACE_HMR_IMPACT_FILES.has(file)
    || WORKSPACE_HMR_IMPACT_PATH_PREFIXES.some(prefix => file.startsWith(prefix))
  ))
}

function isWorkspaceHmrIgnoredChange(file: string) {
  return (
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
    || file.startsWith('docs/')
    || file.endsWith('.md')
  )
}

function selectSmokeProjects(projects: ProjectCase[]) {
  return projects.filter(project => project.kind === 'templates')
}

async function readChangedFiles() {
  const explicit = process.env.WORKSPACE_HMR_CHANGED_FILES
  if (explicit) {
    return splitChangedFiles(explicit)
  }

  const refs = [
    process.env.WORKSPACE_HMR_BASE_REF,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined,
    process.env.GITHUB_BASE_REF,
    'origin/main',
    'main',
    'HEAD~1',
  ].filter((value): value is string => Boolean(value))

  for (const ref of refs) {
    for (const range of [`${ref}...HEAD`, `${ref}..HEAD`]) {
      try {
        const { stdout } = await execFile('git', ['diff', '--name-only', range], {
          cwd: repoRoot,
          maxBuffer: 1024 * 1024,
        })
        const changedFiles = splitChangedFiles(stdout)
        if (changedFiles.length) {
          process.stdout.write(`[workspace-hmr] changed files from ${range}: ${changedFiles.length}\n`)
          return changedFiles
        }
      }
      catch {}
    }
  }
  return []
}

function splitChangedFiles(raw: string) {
  return raw.split(/[\n,]+/).map(file => normalizePath(file.trim())).filter(Boolean)
}

function resolveChangedProjectIds(changedFiles: string[]) {
  const projectIds = new Set<string>()
  for (const file of changedFiles) {
    const [root, name] = file.split('/')
    if ((root === 'apps' || root === 'templates' || root === 'e2e-apps') && name) {
      projectIds.add(`${root}/${name}`)
    }
  }
  return projectIds
}

async function discoverProjects(): Promise<ProjectCase[]> {
  const projects: ProjectCase[] = []
  for (const kind of ROOTS) {
    const rootDir = path.join(repoRoot, kind)
    for (const name of await readdir(rootDir)) {
      if (name.startsWith('__')) {
        continue
      }
      const root = path.join(rootDir, name)
      const packageJsonPath = path.join(root, 'package.json')
      if (!(await pathExists(packageJsonPath))) {
        continue
      }
      const id = `${kind}/${name}`
      if (SKIPPED_PROJECT_IDS.has(id)) {
        continue
      }
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
      if (!packageJson.scripts?.dev) {
        continue
      }
      const sourceRoot = await resolveSourceRoot(root)
      if (!sourceRoot) {
        continue
      }
      const platform = await resolvePlatform(root)
      projects.push({
        id,
        kind,
        root,
        distRoot: await resolveDistRoot(root, platform),
        sourceRoot,
        platform,
      })
    }
  }
  return projects.sort((left, right) => left.id.localeCompare(right.id))
}

async function resolveDistRoot(root: string, platform: RuntimePlatform) {
  if (await pathExists(path.join(root, `config/${platform}`))) {
    return path.join(root, 'dist', platform, 'dist')
  }
  return path.join(root, 'dist')
}

async function resolveSourceRoot(root: string) {
  for (const sourceDir of SOURCE_DIRS) {
    const sourceRoot = path.join(root, sourceDir)
    if (
      await pathExists(path.join(sourceRoot, 'app.json'))
      || await pathExists(path.join(sourceRoot, 'app.json.ts'))
      || await pathExists(path.join(sourceRoot, 'app.vue'))
    ) {
      return sourceRoot
    }
  }
}

async function resolvePlatform(root: string): Promise<RuntimePlatform> {
  if (await pathExists(path.join(root, 'project.config.json'))) {
    return 'weapp'
  }
  if (await pathExists(path.join(root, 'config/weapp/project.config.json'))) {
    return 'weapp'
  }
  if (await pathExists(path.join(root, 'mini.project.json'))) {
    return 'alipay'
  }
  if (await pathExists(path.join(root, 'config/alipay/mini.project.json'))) {
    return 'alipay'
  }
  return 'weapp'
}

async function auditProject(project: ProjectCase): Promise<ProjectResult> {
  const profilePath = path.join(project.root, '.weapp-vite/hmr-profile.jsonl')
  const distRoot = project.distRoot
  const scenarios = await discoverScenarios(project)
  const selectedScenarios = maxScenariosPerProject
    ? scenarios.slice(0, maxScenariosPerProject)
    : scenarios
  const result: ProjectResult = {
    id: project.id,
    kind: project.kind,
    platform: project.platform,
    source: formatProjectPath(project.root),
    scenarios: selectedScenarios.map(scenario => ({
      id: scenario.id,
      label: scenario.label,
      source: formatProjectPath(scenario.sourcePath),
      output: formatProjectPath(scenario.outputPath),
    })),
  }

  if (!selectedScenarios.length) {
    result.error = 'No auditable HMR scenarios discovered.'
    return result
  }

  const backups = new Map<string, string>()
  for (const scenario of selectedScenarios) {
    if (!backups.has(scenario.sourcePath)) {
      backups.set(scenario.sourcePath, await readFile(scenario.sourcePath, 'utf8'))
    }
  }

  await rm(path.join(project.root, 'dist'), { recursive: true, force: true }).catch(() => {})
  await rm(profilePath, { force: true }).catch(() => {})
  await cleanupResidualDevProcesses()

  const dev = startDevProcess(process.execPath, [
    cliPath,
    'dev',
    formatProjectPath(project.root),
    '--platform',
    project.platform,
    '--skipNpm',
  ], {
    cwd: repoRoot,
    env: {
      ...createDevProcessEnv(),
      WEAPP_VITE_HMR_PROFILE_JSON: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
  })

  try {
    const startupStart = performance.now()
    await dev.waitFor(waitForFile(path.join(distRoot, 'app.json'), startupTimeoutMs), `${project.id} app.json`)
    await sleep(settleMs)
    const runnableScenarios = []
    for (const scenario of selectedScenarios) {
      if (await pathExists(scenario.outputPath)) {
        runnableScenarios.push(scenario)
      }
    }
    if (!runnableScenarios.length) {
      throw new Error('No discovered HMR scenario produced an initial output.')
    }
    result.startupMs = performance.now() - startupStart

    const scenarioResults: ScenarioResult[] = []
    for (const scenario of runnableScenarios) {
      scenarioResults.push(await auditScenario(project, scenario, profilePath, distRoot))
    }
    result.scenarios = scenarioResults
  }
  catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  finally {
    await dev.stop(5_000).catch(() => {})
    for (const [filePath, source] of backups) {
      await writeFile(filePath, source, 'utf8').catch(() => {})
    }
    await cleanupResidualDevProcesses()
  }

  return result
}

async function auditScenario(
  project: ProjectCase,
  scenario: ScenarioCase,
  profilePath: string,
  distRoot: string,
): Promise<ScenarioResult> {
  const original = await readFile(scenario.sourcePath, 'utf8')
  const marker = createMarker(project.id, scenario.id)
  const expectedMarker = scenario.expectedMarker?.(marker) ?? marker
  const updated = scenario.mutate(original, marker)
  const result: ScenarioResult = {
    id: scenario.id,
    label: scenario.label,
    source: formatProjectPath(scenario.sourcePath),
    output: formatProjectPath(scenario.outputPath),
    marker,
  }

  if (updated === original) {
    return {
      ...result,
      error: 'Mutation did not change source.',
    }
  }

  try {
    const profileLineCount = await countJsonlLines(profilePath)
    const before = await snapshotDist(distRoot)
    const startedAt = performance.now()
    await replaceFileByRename(scenario.sourcePath, updated)
    await waitForFileContains(scenario.outputPath, expectedMarker, scenarioTimeoutMs)
    await sleep(settleMs)
    const after = await snapshotDist(distRoot)
    result.profile = await waitForHmrProfileSample(project, profilePath, profileLineCount, scenario.sourcePath, 5_000)
    result.observedMs = performance.now() - startedAt
    result.totalMs = result.profile?.totalMs ?? result.observedMs
    result.impact = diffDistSnapshots(before, after)
  }
  catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  finally {
    await replaceFileByRename(scenario.sourcePath, original).catch(() => {})
    await waitForFileNotContains(scenario.outputPath, expectedMarker, scenarioTimeoutMs).catch(() => {})
    await sleep(settleMs)
  }

  return result
}

async function discoverScenarios(project: ProjectCase): Promise<ScenarioCase[]> {
  const files = (await listFiles(project.sourceRoot))
    .sort((left, right) => scoreSourceFile(project.sourceRoot, left) - scoreSourceFile(project.sourceRoot, right)
      || left.localeCompare(right))
  const scenarios: ScenarioCase[] = []
  const nativeTemplate = findFirst(files, filePath => isNativeTemplate(filePath) && isEntryLikeSource(project.sourceRoot, filePath))
  const nativeStyle = findFirst(files, filePath => isStyle(filePath) && isEntryLikeSource(project.sourceRoot, filePath) && isSidecarEntryFile(filePath))
  const nativeScript = findFirst(files, filePath => isScript(filePath) && isEntryLikeSource(project.sourceRoot, filePath) && isScriptEntryFile(filePath))
  const vueFile = findFirst(files, filePath => filePath.endsWith('.vue') && isPageLikeSource(project.sourceRoot, filePath))

  if (nativeTemplate) {
    scenarios.push(createNativeTemplateScenario(project, nativeTemplate))
  }
  if (nativeScript) {
    scenarios.push(createNativeScriptScenario(project, nativeScript))
  }
  if (nativeStyle) {
    scenarios.push(createNativeStyleScenario(project, nativeStyle))
  }
  if (vueFile) {
    const vueSource = await readFile(vueFile, 'utf8')
    const vueScenarios = createVueScenarios(project, vueFile, vueSource)
    scenarios.push(...vueScenarios)
  }

  return dedupeScenarios(scenarios)
}

function createNativeTemplateScenario(project: ProjectCase, sourcePath: string): ScenarioCase {
  return {
    id: 'native-template',
    label: 'native template',
    sourcePath,
    outputPath: resolveOutputPath(project, sourcePath, PLATFORM_EXT[project.platform].template),
    mutate: (source, marker) => {
      if (source.includes('</body>')) {
        return source.replace('</body>', `<view hidden>${marker}</view>\n</body>`)
      }
      return `${source.trimEnd()}\n<view hidden>${marker}</view>\n`
    },
  }
}

function createNativeScriptScenario(project: ProjectCase, sourcePath: string): ScenarioCase {
  return {
    id: 'native-script',
    label: 'native script',
    sourcePath,
    outputPath: resolveOutputPath(project, sourcePath, 'js'),
    mutate: (source, marker) => `${source.trimEnd()}\nconsole.log('${marker}')\n`,
  }
}

function createNativeStyleScenario(project: ProjectCase, sourcePath: string): ScenarioCase {
  return {
    id: 'native-style',
    label: 'native style',
    sourcePath,
    outputPath: resolveOutputPath(project, sourcePath, PLATFORM_EXT[project.platform].style),
    expectedMarker: marker => toCssIdent(marker),
    mutate: (source, marker) => `${source.trimEnd()}\n.hmr-audit-${toCssIdent(marker)} { color: #0f766e; }\n`,
  }
}

function createVueScenarios(project: ProjectCase, sourcePath: string, source: string): ScenarioCase[] {
  const templateOutput = resolveOutputPath(project, sourcePath, PLATFORM_EXT[project.platform].template)
  const scriptOutput = resolveOutputPath(project, sourcePath, 'js')
  const styleOutput = resolveOutputPath(project, sourcePath, PLATFORM_EXT[project.platform].style)
  return [
    {
      id: 'vue-template',
      label: 'Vue SFC template',
      sourcePath,
      outputPath: templateOutput,
      mutate: (source, marker) => source.replace('</template>', `<view hidden>${marker}</view>\n</template>`),
    },
    {
      id: 'vue-script',
      label: 'Vue SFC script',
      sourcePath,
      outputPath: scriptOutput,
      mutate: (source, marker) => insertBeforeClosingTag(source, 'script', `\nconsole.log('${marker}')\n`),
    },
    {
      id: 'vue-style',
      label: 'Vue SFC style',
      sourcePath,
      outputPath: styleOutput,
      expectedMarker: marker => toCssIdent(marker),
      mutate: (source, marker) => insertBeforeClosingTag(source, 'style', `\n.hmr-audit-${toCssIdent(marker)} { color: #0f766e; }\n`),
    },
  ].filter((scenario) => {
    if (scenario.id === 'vue-template') {
      return source.includes('</template>')
    }
    if (scenario.id === 'vue-script') {
      return source.includes('</script>')
    }
    return source.includes('</style>')
  })
}

function insertBeforeClosingTag(source: string, tagName: string, insertion: string) {
  const closeTag = `</${tagName}>`
  if (!source.includes(closeTag)) {
    return source
  }
  return source.replace(closeTag, `${insertion}${closeTag}`)
}

function dedupeScenarios(scenarios: ScenarioCase[]) {
  const used = new Set<string>()
  const result: ScenarioCase[] = []
  for (const scenario of scenarios) {
    const key = `${scenario.id}:${scenario.sourcePath}`
    if (used.has(key)) {
      continue
    }
    used.add(key)
    result.push(scenario)
  }
  return result
}

function resolveOutputPath(project: ProjectCase, sourcePath: string, outputExt: string) {
  const relative = path.relative(project.sourceRoot, sourcePath)
  const parsed = path.parse(relative)
  return path.join(project.distRoot, parsed.dir, `${parsed.name}.${outputExt}`)
}

function scoreSourceFile(sourceRoot: string, filePath: string) {
  const relative = normalizePath(path.relative(sourceRoot, filePath))
  const basename = path.basename(filePath, path.extname(filePath))
  const segmentScore = relative.startsWith('pages/')
    ? relative.startsWith('pages/index/')
      ? 0
      : 1
    : relative.startsWith('subpackages/')
      ? 2
      : relative.startsWith('components/')
        ? 3
        : 4
  const basenameScore = basename === 'index'
    ? 0
    : basename === 'home'
      ? 1
      : 2
  return segmentScore * 10 + basenameScore
}

function isEntryLikeSource(sourceRoot: string, filePath: string) {
  const relative = normalizePath(path.relative(sourceRoot, filePath))
  return isPageLikeRelative(relative)
    || relative.startsWith('components/')
}

function isPageLikeSource(sourceRoot: string, filePath: string) {
  return isPageLikeRelative(normalizePath(path.relative(sourceRoot, filePath)))
}

function isPageLikeRelative(relative: string) {
  return relative.startsWith('pages/')
    || relative.startsWith('subpackages/')
    || relative.startsWith('package')
}

function isSidecarEntryFile(filePath: string) {
  const ext = path.extname(filePath)
  const basePath = filePath.slice(0, -ext.length)
  return ['.ts', '.js', '.vue', '.json', '.wxml', '.html'].some((candidateExt) => {
    return filePath !== `${basePath}${candidateExt}` && pathExistsSyncLike(`${basePath}${candidateExt}`)
  })
}

function isScriptEntryFile(filePath: string) {
  const basename = path.basename(filePath, path.extname(filePath))
  return basename === 'index' || isSidecarEntryFile(filePath)
}

function pathExistsSyncLike(filePath: string) {
  return existsSync(filePath)
}

function isNativeTemplate(filePath: string) {
  return filePath.endsWith('.wxml') || filePath.endsWith('.html')
}

function isStyle(filePath: string) {
  return ['.wxss', '.scss', '.css', '.less'].some(ext => filePath.endsWith(ext))
}

function isScript(filePath: string) {
  if (filePath.endsWith('.d.ts')) {
    return false
  }
  return ['.ts', '.js', '.tsx', '.jsx'].some(ext => filePath.endsWith(ext))
}

function findFirst(files: string[], predicate: (filePath: string) => boolean) {
  return files.find(predicate)
}

async function snapshotDist(distRoot: string) {
  const snapshot = new Map<string, DistFileSnapshot>()
  for (const filePath of await listFiles(distRoot)) {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      continue
    }
    const content = await readFile(filePath)
    snapshot.set(normalizePath(path.relative(distRoot, filePath)), {
      hash: createHash('sha256').update(content).digest('hex'),
      size: fileStat.size,
    })
  }
  return snapshot
}

function diffDistSnapshots(before: Map<string, DistFileSnapshot>, after: Map<string, DistFileSnapshot>) {
  const result: ImpactFile[] = []
  const paths = new Set([...before.keys(), ...after.keys()])
  for (const filePath of [...paths].sort()) {
    const previous = before.get(filePath)
    const next = after.get(filePath)
    if (!previous && next) {
      result.push({ path: filePath, status: 'added', sizeAfter: next.size })
    }
    else if (previous && !next) {
      result.push({ path: filePath, status: 'removed', sizeBefore: previous.size })
    }
    else if (previous && next && previous.hash !== next.hash) {
      result.push({ path: filePath, status: 'modified', sizeBefore: previous.size, sizeAfter: next.size })
    }
  }
  return result
}

async function waitForHmrProfileSample(
  project: ProjectCase,
  profilePath: string,
  previousLineCount: number,
  sourcePath: string,
  timeoutMs: number,
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const candidates = await readHmrProfileSamplesSince(profilePath, previousLineCount)
    const matched = candidates.find(item => isProfileSampleForSource(project, item, sourcePath))
    if (matched) {
      return matched
    }
    const unattributed = candidates.find(isUnattributedProfileSample)
    if (candidates.length === 1 && unattributed) {
      return withScenarioProfileFallback(project, unattributed, sourcePath)
    }
    if (candidates.length > 0 && candidates.every(isUnattributedProfileSample)) {
      return withScenarioProfileFallback(project, candidates.at(-1)!, sourcePath)
    }
    await sleep(100)
  }
  const candidates = await readHmrProfileSamplesSince(profilePath, previousLineCount)
  const files = candidates.map((item) => {
    return item.sourceRootFile ?? item.relativeFile ?? item.file ?? '<unknown>'
  }).join(', ')
  throw new Error(`Timed out waiting for matching hmr profile sample: ${formatProjectPath(sourcePath)}; candidates: ${files || '<none>'}`)
}

async function readHmrProfileSamplesSince(profilePath: string, previousLineCount: number) {
  const lines = await readJsonlLines(profilePath)
  return lines.slice(previousLineCount).map((line) => {
    try {
      return JSON.parse(line) as HmrProfileSample
    }
    catch {
      return undefined
    }
  }).filter((item): item is HmrProfileSample => item != null)
}

function isUnattributedProfileSample(sample: HmrProfileSample) {
  return !sample.file && !sample.relativeFile && !sample.sourceRootFile
}

function withScenarioProfileFallback(project: ProjectCase, sample: HmrProfileSample, sourcePath: string): HmrProfileSample {
  return {
    ...sample,
    event: sample.event ?? 'update',
    file: sample.file ?? normalizePath(sourcePath),
    relativeFile: sample.relativeFile ?? normalizePath(path.relative(project.root, sourcePath)),
    sourceRootFile: sample.sourceRootFile ?? normalizePath(path.relative(project.sourceRoot, sourcePath)),
    dirtyCount: sample.dirtyCount ?? 1,
    pendingCount: sample.pendingCount ?? 1,
    emittedCount: sample.emittedCount ?? 1,
    dirtyReasonSummary: sample.dirtyReasonSummary ?? ['audit-unattributed:1'],
  }
}

function isProfileSampleForSource(project: ProjectCase, sample: HmrProfileSample, sourcePath: string) {
  const expected = new Set([
    normalizePath(sourcePath),
    formatProjectPath(sourcePath),
    normalizePath(path.relative(project.root, sourcePath)),
    normalizePath(path.relative(project.sourceRoot, sourcePath)),
  ])
  const candidates = [
    sample.file,
    sample.relativeFile,
    sample.sourceRootFile,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(normalizePath)
  const expectedBases = new Set([...expected].map(removeFileExtension))

  return candidates.some((candidate) => {
    return expected.has(candidate)
      || expectedBases.has(removeFileExtension(candidate))
      || [...expected].some(item => item.endsWith(`/${candidate}`))
      || [...expected].some(item => candidate.endsWith(`/${item}`))
  })
}

function removeFileExtension(filePath: string) {
  const ext = path.extname(filePath)
  return ext ? filePath.slice(0, -ext.length) : filePath
}

async function countJsonlLines(filePath: string) {
  return (await readJsonlLines(filePath)).length
}

async function readJsonlLines(filePath: string) {
  const content = await readFile(filePath, 'utf8').catch(() => '')
  return content.split(/\r?\n/).filter(Boolean)
}

async function waitForFile(filePath: string, timeoutMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await pathExists(filePath)) {
      return
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for file: ${formatReportPath(filePath)}`)
}

async function waitForFileContains(filePath: string, marker: string, timeoutMs: number) {
  if (!marker) {
    await waitForFile(filePath, timeoutMs)
    return
  }
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
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

async function waitForFileNotContains(filePath: string, marker: string, timeoutMs: number) {
  if (!marker) {
    await waitForFile(filePath, timeoutMs)
    return
  }
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await pathExists(filePath)) {
      const content = await readFile(filePath, 'utf8')
      if (!content.includes(marker)) {
        return
      }
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${formatReportPath(filePath)} to remove marker: ${marker}`)
}

async function listFiles(root: string) {
  if (!(await pathExists(root))) {
    return []
  }
  const result: string[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const filePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        continue
      }
      result.push(...await listFiles(filePath))
    }
    else if (entry.isFile()) {
      result.push(filePath)
    }
  }
  return result.sort((left, right) => left.localeCompare(right))
}

function shouldSkipDir(name: string) {
  return name === 'node_modules'
    || name === 'dist'
    || name === '.weapp-vite'
    || name === '.turbo'
    || name === '.tmp'
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

function createMarker(projectId: string, scenarioId: string) {
  return `HMR_AUDIT_${toIdentifier(projectId)}_${toIdentifier(scenarioId)}_${Date.now().toString(36)}`
}

function toCssIdent(value: string) {
  return value.replaceAll('_', '-').toLowerCase()
}

function toIdentifier(value: string) {
  return value.replaceAll(/[^a-z0-9]+/gi, '_').replaceAll(/^_+|_+$/g, '').toUpperCase()
}

function normalizePath(filePath: string) {
  return filePath.replaceAll(path.sep, '/')
}

function formatProjectPath(filePath: string) {
  return normalizePath(path.relative(repoRoot, filePath))
}

function formatReportPath(filePath: string) {
  const relative = path.relative(repoRoot, filePath)
  return relative.startsWith('..') ? normalizePath(filePath) : normalizePath(relative)
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function readPositiveIntegerEnv(name: string, defaultValue: number) {
  const raw = process.env[name]
  if (!raw) {
    return defaultValue
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${raw}`)
  }
  return value
}

function readOptionalPositiveIntegerEnv(name: string) {
  const raw = process.env[name]
  if (!raw) {
    return undefined
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${raw}`)
  }
  return value
}

function readRunMode(raw: string | undefined): WorkspaceHmrRunMode {
  if (!raw) {
    return 'full'
  }
  if (raw === 'full' || raw === 'smoke' || raw === 'changed-project' || raw === 'nightly-full') {
    return raw
  }
  throw new Error(`Invalid WORKSPACE_HMR_MODE: ${raw}`)
}

async function readWorkspaceHmrBaseline(filePath: string): Promise<WorkspaceHmrBaseline | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as WorkspaceHmrBaseline
}

async function writeGitHubStepSummary(results: ProjectResult[], thresholdMarkdown: string) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) {
    return
  }
  const failedProjects = results.filter(project => project.error || project.scenarios.some(scenario => scenario.error))
  const lines = [
    '## Workspace HMR Audit',
    '',
    `- mode: ${runMode}`,
    `- projects: ${results.length}`,
    `- failures: ${failedProjects.length}`,
    `- report: ${formatReportPath(reportMdPath)}`,
    '',
    thresholdMarkdown,
    '',
  ]
  await appendFile(summaryPath, `${lines.join('\n')}\n`, 'utf8')
}

function renderMarkdown(results: ProjectResult[], thresholdMarkdown: string) {
  const lines = [
    '# Workspace HMR Audit',
    '',
    `- mode: ${runMode}`,
    `- generated projects: ${results.length}`,
    `- baseline: ${pathExistsSyncLike(baselinePath) ? formatReportPath(baselinePath) : '-'}`,
    `- startup timeout: ${startupTimeoutMs}ms`,
    `- scenario timeout: ${scenarioTimeoutMs}ms`,
    `- max scenarios per project: ${maxScenariosPerProject ?? '-'}`,
    '',
    '| project | platform | startup(ms) | scenarios | failures |',
    '| --- | --- | ---: | ---: | --- |',
  ]
  for (const project of results) {
    const failures = [
      project.error,
      ...project.scenarios.filter(scenario => scenario.error).map(scenario => `${scenario.id}: ${scenario.error}`),
    ].filter(Boolean)
    lines.push([
      project.id,
      project.platform,
      project.startupMs == null ? '-' : project.startupMs.toFixed(1),
      String(project.scenarios.length),
      failures.length ? failures.join('<br>') : '-',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  lines.push('')
  for (const project of results) {
    lines.push(`## ${project.id}`, '')
    if (project.error) {
      lines.push(`- project error: ${project.error}`, '')
      continue
    }
    lines.push('| scenario | total(ms) | dirty | pending | emitted | impact | error |')
    lines.push('| --- | ---: | ---: | ---: | ---: | --- | --- |')
    for (const scenario of project.scenarios) {
      lines.push([
        scenario.id,
        scenario.totalMs == null ? '-' : scenario.totalMs.toFixed(1),
        scenario.profile?.dirtyCount == null ? '-' : String(scenario.profile.dirtyCount),
        scenario.profile?.pendingCount == null ? '-' : String(scenario.profile.pendingCount),
        scenario.profile?.emittedCount == null ? '-' : String(scenario.profile.emittedCount),
        scenario.impact?.map(item => item.path).join('<br>') || '-',
        scenario.error ?? '-',
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
    lines.push('')
  }
  lines.push(thresholdMarkdown.trimEnd(), '')
  return `${lines.join('\n')}\n`
}

function isDirectRun() {
  return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isDirectRun()) {
  await main()
}
