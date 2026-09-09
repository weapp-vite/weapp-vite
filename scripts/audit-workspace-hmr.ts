/* eslint-disable ts/no-use-before-define */
import type { WorkspaceHmrBaseline, WorkspaceHmrThresholds } from './workspace-hmr/baseline'
import type { DynamicReactDeliveryEvidence, DynamicReactMutation } from './workspace-hmr/dynamicReactDelivery'
import type { StatefulHmrAuditEvent } from './workspace-hmr/statefulAuditUpdate'
import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { access, appendFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { sanitizeAcceptanceText, sanitizeAcceptanceValue } from '../e2e/scripts/domAcceptanceReport/helpers'
import { startDevProcess } from '../e2e/utils/dev-process'
import { cleanupResidualDevProcesses } from '../e2e/utils/dev-process-cleanup'
import { createDevProcessEnv } from '../e2e/utils/dev-process-env'
import { readEmittedStylesheet, waitForEmittedStylesheet } from '../e2e/utils/emittedStylesheet'
import { replaceFileByRename } from '../e2e/utils/hmr-helpers'
import { assertBenchmarkPrepareCompleted, assertBenchmarkTypeScriptPrepared, createBenchmarkPrepareArgs, discoverBenchmarkTypeScriptProjects } from './benchmarkCheckoutPreparation/typescript'
import {
  createWorkspaceHmrBaseline,
  evaluateWorkspaceHmrThresholds,
  parseThresholdOverrides,
  renderThresholdMarkdown,
} from './workspace-hmr/baseline'
import { collectWorkspaceHmrCleanupErrors, isWorkspaceHmrScenarioRetryable } from './workspace-hmr/cleanup'
import { prepareDynamicReactMutation } from './workspace-hmr/dynamicReactDelivery'
import { isDynamicReactTemplateOutput } from './workspace-hmr/reactTemplate'
import { renderWorkspaceHmrExecution, summarizeWorkspaceHmrExecution } from './workspace-hmr/report'
import {
  injectReactTemplateMarker,
  injectVueStyleRule,
  isReactTemplateSource,
  parseStatefulHmrControlSource,
  resolveHmrScriptOutputPath,
  resolveReactTemplateOutputPath,
  resolveWorkspaceHmrRuntime,
} from './workspace-hmr/scenarios'
import { assertWorkspaceHmrSelection, selectWorkspaceHmrProjects } from './workspace-hmr/selection'
import { StatefulHmrAuditClient } from './workspace-hmr/statefulAuditClient'
import { waitForStatefulHmrAuditUpdate } from './workspace-hmr/statefulAuditUpdate'

const execFile = promisify(execFileCallback)

interface PackageJson {
  name?: string
  scripts?: Record<string, string>
  workspaceHmr?: {
    runtime?: WorkspaceHmrRuntime
    thresholds?: WorkspaceHmrThresholds
  }
}

interface ProjectCase {
  id: string
  kind: 'apps' | 'templates' | 'e2e-apps'
  root: string
  distRoot: string
  sourceRoot: string
  platform: RuntimePlatform
  hmrRuntime: WorkspaceHmrRuntime
  thresholds?: WorkspaceHmrThresholds
}

type RuntimePlatform = 'weapp' | 'alipay'
type WorkspaceHmrRunMode = 'full' | 'smoke' | 'changed-project' | 'nightly-full'
type WorkspaceHmrProjectKind = 'apps' | 'templates' | 'e2e-apps'
type WorkspaceHmrScope = 'apps,e2e-apps' | 'apps' | 'e2e-apps' | 'templates' | 'workspace'
type WorkspaceHmrWriteMode = 'write' | 'rename'
type WorkspaceHmrPollingMode = 'native' | 'polling'
type WorkspaceHmrRuntime = 'standard' | 'stateful'

interface ScenarioCase {
  id: string
  label: string
  sourcePath: string
  outputPath: string
  expectedMarker?: (marker: string) => string
  mutate: (source: string, marker: string) => string
  statefulClient?: boolean
  dynamicReactEntry?: string
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
  buildStartMs?: number
  pluginResolveMs?: number
  transformMs?: number
  coreTransformMs?: number
  wevuTransformMs?: number
  vueTransformMs?: number
  bundlerMs?: number
  renderStartMs?: number
  generateBundleMs?: number
  generateSharedMs?: number
  generateRewriteMs?: number
  generateModuleGraphMs?: number
  snapshotResolveMs?: number
  snapshotBuildMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  resolveCount?: number
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
  cleanupErrors?: string[]
  delivery?: DynamicReactDeliveryEvidence['delivery']
  deliveryEvidence?: DynamicReactDeliveryEvidence
  restoreDelivery?: DynamicReactDeliveryEvidence
  diagnostics?: {
    transport: StatefulHmrAuditEvent[]
    output: { path: string, exists: boolean, sha256?: string, bytes?: number, containsMarker?: boolean }
    reachableStylesheet?: { containsMarker?: boolean, error?: string }
    recentDevOutput: string
  }
}

interface ProjectResult {
  id: string
  baselineId?: string
  kind: ProjectCase['kind']
  platform: RuntimePlatform
  source: string
  startupMs?: number
  thresholds?: WorkspaceHmrThresholds
  scenarios: ScenarioResult[]
  warmup?: { scenario: string, update?: DynamicReactDeliveryEvidence, restore?: DynamicReactDeliveryEvidence }
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
const workspaceHmrScope = readWorkspaceHmrScope(process.env.WORKSPACE_HMR_SCOPE ?? (runMode === 'smoke' ? 'templates' : 'workspace'))
const startupTimeoutMs = readPositiveIntegerEnv('WORKSPACE_HMR_STARTUP_TIMEOUT_MS', 90_000)
const scenarioTimeoutMs = readPositiveIntegerEnv('WORKSPACE_HMR_TIMEOUT_MS', 30_000)
const settleMs = readPositiveIntegerEnv('WORKSPACE_HMR_SETTLE_MS', 250)
const startupDistStableMs = readPositiveIntegerEnv('WORKSPACE_HMR_STARTUP_DIST_STABLE_MS', 1_000)
const scenarioRetries = readOptionalPositiveIntegerEnv('WORKSPACE_HMR_SCENARIO_RETRIES') ?? 1
const maxScenariosPerProject = readOptionalPositiveIntegerEnv('WORKSPACE_HMR_MAX_SCENARIOS_PER_PROJECT') ?? (runMode === 'smoke' ? 1 : undefined)
const writeMode = readWorkspaceHmrWriteMode(process.env.WORKSPACE_HMR_WRITE_MODE)
const pollingMode = readWorkspaceHmrPollingMode(process.env.WORKSPACE_HMR_USE_POLLING)
const ROOTS: readonly WorkspaceHmrProjectKind[] = ['apps', 'templates', 'e2e-apps']
const PLATFORM_EXT: Record<RuntimePlatform, { template: string, style: string }> = {
  weapp: { template: 'wxml', style: 'wxss' },
  alipay: { template: 'axml', style: 'acss' },
}
const SOURCE_DIRS = ['src', 'miniprogram', '.'] as const
const WORKSPACE_HMR_IMPACT_PATH_PREFIXES = [
  '@weapp-core/',
  'packages/weapp-vite/src/',
  'packages/rolldown-require/src/',
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
  'e2e-apps/github-issues',
  // TDesign layout/scoped-slot 页面会按设计走完整快照重建，不产生 update.js patch。
  'e2e-apps/template-wevu-tdesign-regression',
  'e2e-apps/script-setup-macros-js-with-defaults-invalid',
])
const statefulHmrAuditClients = new Map<string, StatefulHmrAuditClient>()
const WORKSPACE_HMR_BASELINE_PROJECT_ALIASES = new Map<string, string>([
  ['e2e-apps/template-wevu-tdesign-regression', 'templates/weapp-vite-wevu-tailwindcss-tdesign-template'],
])

async function main() {
  await mkdir(reportRoot, { recursive: true })
  await cleanupResidualDevProcesses()
  await prepareReferencedWorkspaceTsconfigs()

  const projects = selectWorkspaceHmrProjects(await selectProjectsForRunMode(await discoverProjects()), projectFilter)

  const results: ProjectResult[] = []
  for (const project of projects) {
    process.stdout.write(`[workspace-hmr] ${project.id}\n`)
    results.push(await auditProject(project))
  }

  const generatedAt = new Date().toISOString()
  let baseline = await readWorkspaceHmrBaseline(baselinePath)
  if (writeBaseline && projects.length) {
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
  const summary = summarizeProjectResults(results)
  const thresholdMarkdown = renderThresholdMarkdown(thresholdEvaluation, summary)
  const report = {
    generatedAt,
    mode: runMode,
    scope: workspaceHmrScope,
    selection: {
      filter: projectFilter,
      status: projects.length ? 'selected' : 'empty',
      projectCount: projects.length,
    },
    baseline: baseline ? formatReportPath(baselinePath) : undefined,
    startupTimeoutMs,
    scenarioTimeoutMs,
    settleMs,
    startupDistStableMs,
    scenarioRetries,
    writeMode,
    pollingMode,
    maxScenariosPerProject,
    summary,
    projects: results,
    thresholds: thresholdEvaluation,
  }
  await writeFile(reportJsonPath, `${JSON.stringify(sanitizeAcceptanceValue(report), null, 2)}\n`, 'utf8')
  await writeFile(thresholdMdPath, `${thresholdMarkdown}\n`, 'utf8')
  await writeFile(reportMdPath, renderMarkdown(results, summary, thresholdMarkdown), 'utf8')
  await writeGitHubStepSummary(results, summary, thresholdMarkdown)

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
  if (!projects.length) {
    process.stdout.write('[workspace-hmr] no projects selected; this report contains no acceptance results.\n')
  }
  assertWorkspaceHmrSelection(projects.length, failOnError)
  if (failOnError && (failedProjects.length || thresholdEvaluation.issues.length)) {
    process.exitCode = 1
  }
}

async function prepareReferencedWorkspaceTsconfigs() {
  const workspaceTsconfigPath = path.join(repoRoot, 'tsconfig.json')
  if (!existsSync(workspaceTsconfigPath)) {
    return
  }
  const projects = await discoverBenchmarkTypeScriptProjects(repoRoot)
  for (const project of projects) {
    process.stdout.write(`[workspace-hmr] prepare referenced project ${project.root}\n`)
    const args = createBenchmarkPrepareArgs(project.root)
    const result = await execFile(process.execPath, [cliPath, ...args.slice(1)], {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
    })
    const output = `${result.stdout}\n${result.stderr}`
    process.stdout.write(sanitizeAcceptanceText(output, repoRoot))
    assertBenchmarkPrepareCompleted(project.root, { exitCode: 0, output })
  }
  await assertBenchmarkTypeScriptPrepared(repoRoot, projects)
}

async function selectProjectsForRunMode(projects: ProjectCase[]) {
  if (runMode === 'smoke') {
    return selectSmokeProjects(projects, workspaceHmrScope)
  }
  if (runMode === 'changed-project') {
    const changedFiles = await readChangedFiles()
    const projectIds = resolveChangedProjectIds(changedFiles, workspaceHmrScope)
    const selected = projects.filter(project => projectIds.has(project.id))
    if (selected.length) {
      process.stdout.write(`[workspace-hmr] changed projects: ${selected.map(project => project.id).join(', ')}\n`)
      return selected
    }
    if (shouldFallbackToSmokeForChangedFiles(changedFiles)) {
      const smokeProjects = selectSmokeProjects(projects, workspaceHmrScope)
      process.stdout.write(`[workspace-hmr] no changed runnable projects detected; falling back to ${workspaceHmrScope} smoke: ${smokeProjects.map(project => project.id).join(', ') || '<none>'}\n`)
      return smokeProjects
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
    || isWorkspaceProjectPackageJson(file)
    || isWorkspaceProjectWebEntry(file)
  )
}

function isWorkspaceProjectPackageJson(file: string) {
  const segments = file.split('/')
  return (
    segments.length === 3
    && isWorkspaceHmrProjectKind(segments[0])
    && segments[2] === 'package.json'
  )
}

function isWorkspaceProjectWebEntry(file: string) {
  const segments = file.split('/')
  return (
    segments.length === 3
    && isWorkspaceHmrProjectKind(segments[0])
    && segments[2] === 'index.html'
  )
}

function selectSmokeProjects(projects: ProjectCase[], scope: WorkspaceHmrScope) {
  if (scope === 'templates') {
    return projects.filter(project => project.kind === 'templates')
  }
  const selectedIds = selectWorkspaceHmrSmokeProjectIds(projects, scope)
  return projects.filter(project => selectedIds.has(project.id))
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

export function resolveChangedProjectIds(changedFiles: string[], scope: WorkspaceHmrScope = workspaceHmrScope) {
  const scopedRoots = new Set(rootsForScope(scope))
  const projectIds = new Set<string>()
  for (const file of changedFiles) {
    if (isWorkspaceHmrIgnoredChange(file)) {
      continue
    }
    const [root, name] = file.split('/')
    if (isWorkspaceHmrProjectKind(root) && scopedRoots.has(root) && name) {
      const projectId = `${root}/${name}`
      if (!isWorkspaceHmrSkippedProject(projectId)) {
        projectIds.add(projectId)
      }
    }
  }
  return projectIds
}

function isWorkspaceHmrSkippedProject(projectId: string) {
  return SKIPPED_PROJECT_IDS.has(projectId)
}

async function discoverProjects(): Promise<ProjectCase[]> {
  const projects: ProjectCase[] = []
  for (const kind of rootsForScope(workspaceHmrScope)) {
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
        hmrRuntime: packageJson.workspaceHmr?.runtime === 'stateful' ? 'stateful' : 'standard',
        thresholds: packageJson.workspaceHmr?.thresholds,
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
  let scenarios = await discoverScenarios(project)
  let selectedScenarios = maxScenariosPerProject
    ? scenarios.slice(0, maxScenariosPerProject)
    : scenarios
  const result: ProjectResult = {
    id: project.id,
    baselineId: WORKSPACE_HMR_BASELINE_PROJECT_ALIASES.get(project.id),
    kind: project.kind,
    platform: project.platform,
    source: formatProjectPath(project.root),
    thresholds: project.thresholds,
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
  statefulHmrAuditClients.delete(project.root)
  await cleanupResidualDevProcesses()

  const dev = startDevProcess(process.execPath, [
    cliPath,
    'dev',
    '--platform',
    project.platform,
    '--skipNpm',
  ], {
    cwd: project.root,
    env: {
      ...createDevProcessEnv({
        usePolling: pollingMode === 'polling',
      }),
      WEAPP_VITE_HMR_PROFILE_JSON: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
  })

  try {
    const startupStart = performance.now()
    await dev.waitFor(waitForFile(path.join(distRoot, 'app.json'), startupTimeoutMs), `${project.id} app.json`)
    await waitForStableDistSnapshot(distRoot, startupDistStableMs, startupTimeoutMs)
    await sleep(settleMs)
    project.hmrRuntime = resolveWorkspaceHmrRuntime(await pathExists(path.join(
      distRoot,
      '__weapp_vite_hmr/control.js',
    )))
    scenarios = await discoverScenarios(project, true)
    selectedScenarios = maxScenariosPerProject
      ? scenarios.slice(0, maxScenariosPerProject)
      : scenarios
    result.scenarios = selectedScenarios.map(scenario => ({
      id: scenario.id,
      label: scenario.label,
      source: formatProjectPath(scenario.sourcePath),
      output: formatProjectPath(scenario.outputPath),
    }))
    const runnableScenarios = []
    for (const scenario of selectedScenarios) {
      if (!(await pathExists(scenario.outputPath))) {
        throw new Error(`Discovered HMR scenario ${scenario.id} did not produce initial output: ${formatProjectPath(scenario.outputPath)}`)
      }
      runnableScenarios.push(scenario)
    }
    if (!runnableScenarios.length) {
      throw new Error('No discovered HMR scenario produced an initial output.')
    }
    result.startupMs = performance.now() - startupStart
    const warmupScenario = runnableScenarios[0]!
    const warmup = await warmupProjectHmr(project, warmupScenario, profilePath, distRoot)
    if (warmup?.update || warmup?.restore) {
      result.warmup = { scenario: warmupScenario.id, ...warmup }
    }

    const scenarioResults: ScenarioResult[] = []
    for (const scenario of runnableScenarios) {
      const scenarioResult = await auditScenarioWithRetries(project, scenario, profilePath, distRoot, () => dev.getOutput())
      scenarioResults.push(scenarioResult)
      if (scenarioResult.cleanupErrors?.length) {
        result.scenarios = [
          ...scenarioResults,
          ...result.scenarios.slice(scenarioResults.length).map(pending => ({ ...pending, error: 'Not executed: previous scenario did not restore its baseline.' })),
        ]
        throw new Error(`Cannot continue after ${scenario.id}: source/output restoration failed.`)
      }
    }
    result.scenarios = scenarioResults
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const devOutput = dev.getOutput().trim()
    result.error = sanitizeAcceptanceText(devOutput
      ? `${message}\n\nRecent dev output:\n${devOutput.slice(-12_000)}`
      : message)
  }
  finally {
    const cleanupErrors = await collectWorkspaceHmrCleanupErrors([
      { label: 'Failed to stop dev process', run: () => dev.stop(5_000) },
      ...[...backups].map(([filePath, source]) => ({
        label: `Failed to restore backup ${formatProjectPath(filePath)}`,
        run: () => writeFile(filePath, source, 'utf8'),
      })),
      { label: 'Failed to clean residual dev processes', run: () => cleanupResidualDevProcesses() },
    ])
    if (cleanupErrors.length) {
      result.error = [result.error, ...cleanupErrors.map(error => sanitizeAcceptanceText(error))].filter(Boolean).join('\n')
    }
    statefulHmrAuditClients.delete(project.root)
  }

  return result
}

async function warmupProjectHmr(
  project: ProjectCase,
  scenario: ScenarioCase,
  profilePath: string,
  distRoot: string,
) {
  const original = await readFile(scenario.sourcePath, 'utf8')
  const marker = createMarker(project.id, `${scenario.id}-warmup`)
  const expectedMarker = scenario.expectedMarker?.(marker) ?? marker
  const updated = scenario.mutate(original, marker)
  if (updated === original) {
    return
  }

  const mutation = await prepareScenarioMutation(project, scenario)
  const profileLineCount = await countJsonlLines(profilePath)
  let delivery: DynamicReactDeliveryEvidence | undefined
  let restore: DynamicReactDeliveryEvidence | undefined
  try {
    await writeScenarioSource(scenario.sourcePath, updated)
    delivery = await waitForScenarioMutation(project, scenario, mutation, expectedMarker, true)
    if (project.hmrRuntime === 'standard') {
      await waitForHmrProfileSample(project, profilePath, profileLineCount, scenario.sourcePath, 5_000).catch(() => {})
    }
  }
  finally {
    restore = await restoreScenarioMutation(project, scenario, original, expectedMarker)
  }
  await waitForStableDistSnapshot(distRoot, startupDistStableMs, scenarioTimeoutMs)
  await rm(profilePath, { force: true }).catch(() => {})
  await sleep(settleMs)
  return { update: delivery, restore }
}

async function auditScenarioWithRetries(
  project: ProjectCase,
  scenario: ScenarioCase,
  profilePath: string,
  distRoot: string,
  getDevOutput: () => string,
) {
  let result = await auditScenario(project, scenario, profilePath, distRoot, getDevOutput)
  for (let attempt = 1; isWorkspaceHmrScenarioRetryable(result) && attempt <= scenarioRetries; attempt++) {
    process.stdout.write(`[workspace-hmr] retry ${project.id} ${scenario.id}: ${result.error}\n`)
    result = await auditScenario(project, scenario, profilePath, distRoot, getDevOutput)
  }
  return result
}

async function auditScenario(
  project: ProjectCase,
  scenario: ScenarioCase,
  profilePath: string,
  distRoot: string,
  getDevOutput: () => string,
): Promise<ScenarioResult> {
  const original = await readFile(scenario.sourcePath, 'utf8')
  const marker = createMarker(project.id, scenario.id)
  const expectedMarker = scenario.expectedMarker?.(marker) ?? marker
  const updated = scenario.mutate(original, marker)
  const transport: StatefulHmrAuditEvent[] = []
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
    const mutation = await prepareScenarioMutation(project, scenario)
    const profileLineCount = await countJsonlLines(profilePath)
    const before = await snapshotDist(distRoot)
    const startedAt = performance.now()
    await writeScenarioSource(scenario.sourcePath, updated)
    const delivery = await waitForScenarioMutation(project, scenario, mutation, expectedMarker, true, (event) => {
      transport.push(event)
      if (transport.length > 32) {
        transport.shift()
      }
    })
    if (delivery) {
      result.delivery = delivery.delivery
      result.deliveryEvidence = delivery
      result.output = formatProjectPath(path.join(project.distRoot, delivery.output))
    }
    result.observedMs = performance.now() - startedAt
    await sleep(settleMs)
    const after = await snapshotDist(distRoot)
    if (project.hmrRuntime === 'standard') {
      result.profile = await waitForHmrProfileSample(project, profilePath, profileLineCount, scenario.sourcePath, 5_000)
    }
    result.totalMs = project.hmrRuntime === 'standard'
      ? result.profile?.totalMs ?? result.observedMs
      : undefined
    result.impact = diffDistSnapshots(before, after)
  }
  catch (error) {
    result.error = sanitizeAcceptanceText(error instanceof Error ? error.message : String(error))
    const output = await readFile(scenario.outputPath).catch(() => undefined)
    result.diagnostics = {
      transport,
      output: {
        path: formatProjectPath(scenario.outputPath),
        exists: output !== undefined,
        sha256: output && createHash('sha256').update(output).digest('hex'),
        bytes: output?.byteLength,
        containsMarker: output?.toString('utf8').includes(expectedMarker),
      },
      recentDevOutput: sanitizeAcceptanceText(getDevOutput().slice(-12_000)),
    }
    if (isStylesheetOutput(scenario.outputPath)) {
      try {
        result.diagnostics.reachableStylesheet = { containsMarker: (await readEmittedStylesheet(scenario.outputPath)).includes(expectedMarker) }
      }
      catch (error) {
        result.diagnostics.reachableStylesheet = { error: sanitizeAcceptanceText(error instanceof Error ? error.message : String(error)) }
      }
    }
  }
  finally {
    const restoreProfileLineCount = await countJsonlLines(profilePath).catch(() => 0)
    const cleanupErrors = await collectWorkspaceHmrCleanupErrors([
      {
        label: 'Failed to restore source and verify delivered output',
        run: async () => {
          result.restoreDelivery = await restoreScenarioMutation(project, scenario, original, expectedMarker)
        },
      },
      { label: 'Restored output did not settle', run: () => waitForStableDistSnapshot(distRoot, startupDistStableMs, scenarioTimeoutMs) },
    ])
    if (cleanupErrors.length) {
      result.cleanupErrors = cleanupErrors.map(error => sanitizeAcceptanceText(error))
      result.error = [result.error, ...result.cleanupErrors].filter(Boolean).join('\n')
    }
    if (project.hmrRuntime === 'standard') {
      await waitForHmrProfileSample(project, profilePath, restoreProfileLineCount, scenario.sourcePath, 5_000).catch(() => {})
    }
    await sleep(settleMs)
  }

  return result
}

async function discoverScenarios(project: ProjectCase, requireOutputs = false): Promise<ScenarioCase[]> {
  const files = (await listFiles(project.sourceRoot))
    .sort((left, right) => scoreSourceFile(project.sourceRoot, left) - scoreSourceFile(project.sourceRoot, right)
      || left.localeCompare(right))
  const scenarios: ScenarioCase[] = []
  const nativeTemplate = findPreferredSource(files, filePath => isNativeTemplate(filePath) && isEntryLikeSource(project.sourceRoot, filePath))
  const nativeStyle = findPreferredSource(files, filePath => isStyle(filePath) && isEntryLikeSource(project.sourceRoot, filePath) && isSidecarEntryFile(filePath))
  const nativeScript = findPreferredSource(files, filePath => isScript(filePath) && isAuditableScriptEntry(project.sourceRoot, filePath))
  const vueFile = findPreferredVueSource(files, project.sourceRoot)
  const reactTemplate = findPreferredSource(files, filePath => isReactTemplateSource(filePath) && isPageLikeSource(project.sourceRoot, filePath))

  if (reactTemplate) {
    scenarios.push(await createReactTemplateScenario(project, reactTemplate, requireOutputs))
  }
  else if (nativeTemplate) {
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

async function createReactTemplateScenario(project: ProjectCase, sourcePath: string, requireOutput: boolean): Promise<ScenarioCase> {
  const templateOutput = resolveReactTemplateOutputPath(project, sourcePath)
  const dynamic = await isDynamicReactTemplateOutput(templateOutput, requireOutput)
  return {
    id: 'react-template',
    label: dynamic ? 'React TSX dynamic-render script' : 'React TSX static template',
    sourcePath,
    outputPath: dynamic ? resolveHmrScriptOutputPath(project, path.join(path.dirname(sourcePath), 'index.ts')) : templateOutput,
    statefulClient: dynamic && project.hmrRuntime === 'stateful',
    dynamicReactEntry: dynamic && project.hmrRuntime === 'stateful'
      ? path.join(path.dirname(templateOutput), 'index.js')
      : undefined,
    mutate: injectReactTemplateMarker,
  }
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
    outputPath: resolveHmrScriptOutputPath(project, sourcePath),
    statefulClient: project.hmrRuntime === 'stateful',
    mutate: (source, marker) => `${source.trimEnd()}\nglobalThis.__WEAPP_VITE_HMR_AUDIT__ = '${marker}'\n`,
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
  const scriptOutput = resolveHmrScriptOutputPath(project, sourcePath)
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
      statefulClient: project.hmrRuntime === 'stateful',
      mutate: (source, marker) => insertBeforeClosingTag(source, 'script', `\nglobalThis.__WEAPP_VITE_HMR_AUDIT__ = '${marker}'\n`),
    },
    {
      id: 'vue-style',
      label: 'Vue SFC style',
      sourcePath,
      outputPath: styleOutput,
      expectedMarker: marker => toCssIdent(marker),
      mutate: (source, marker) => injectVueStyleRule(source, `.hmr-audit-${toCssIdent(marker)} { color: #0f766e; }`),
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

async function prepareScenarioMutation(project: ProjectCase, scenario: ScenarioCase) {
  if (scenario.dynamicReactEntry) {
    if (scenario.id !== 'react-template' || !scenario.statefulClient) {
      throw new Error('Full-reload delivery is restricted to explicit stateful dynamic React scenarios.')
    }
    const client = statefulHmrAuditClients.get(project.root) ?? new StatefulHmrAuditClient()
    statefulHmrAuditClients.set(project.root, client)
    return await prepareDynamicReactMutation({
      client,
      distRoot: project.distRoot,
      entryFile: scenario.dynamicReactEntry,
      timeoutMs: scenarioTimeoutMs,
    })
  }
  if (scenario.statefulClient) {
    await prepareStatefulHmrAuditClient(project)
  }
}

async function waitForScenarioMutation(
  project: ProjectCase,
  scenario: ScenarioCase,
  mutation: DynamicReactMutation | undefined,
  marker: string,
  contains: boolean,
  onEvent?: (event: StatefulHmrAuditEvent) => void,
) {
  if (scenario.dynamicReactEntry) {
    if (!mutation) {
      throw new Error('Dynamic React mutation is missing its pre-mutation build identity.')
    }
    return await mutation.waitForDelivery(marker, contains, onEvent)
  }
  if (scenario.statefulClient) {
    await publishStatefulHmrUpdate(project, scenario.outputPath, marker, contains, onEvent)
  }
  if (contains) {
    await waitForFileContains(scenario.outputPath, marker, scenarioTimeoutMs)
  }
  else {
    await waitForFileNotContains(scenario.outputPath, marker, scenarioTimeoutMs)
  }
}

async function restoreScenarioMutation(project: ProjectCase, scenario: ScenarioCase, source: string, marker: string) {
  let preparationError: unknown
  const mutation = await prepareScenarioMutation(project, scenario).catch((error) => {
    preparationError = error
    return undefined
  })
  // 即使当前构建无法读取，也先恢复源码；缺失构建身份不能被当作恢复验收通过。
  await writeScenarioSource(scenario.sourcePath, source)
  if (preparationError) {
    throw preparationError
  }
  return await waitForScenarioMutation(project, scenario, mutation, marker, false)
}

async function publishStatefulHmrUpdate(
  project: ProjectCase,
  outputPath: string,
  marker: string,
  contains: boolean,
  onEvent?: (event: StatefulHmrAuditEvent) => void,
) {
  const controlPath = path.join(project.distRoot, '__weapp_vite_hmr/control.js')
  const client = await prepareStatefulHmrAuditClient(project)
  await waitForStatefulHmrAuditUpdate({
    client,
    readControl: async () => parseStatefulHmrControlSource(await readFile(controlPath, 'utf8')),
    isCurrentUpdate: async () => (await readFile(outputPath, 'utf8')).includes(marker) === contains,
    timeoutMs: scenarioTimeoutMs,
    onEvent,
  })
}

async function prepareStatefulHmrAuditClient(project: ProjectCase) {
  const client = statefulHmrAuditClients.get(project.root) ?? new StatefulHmrAuditClient()
  statefulHmrAuditClients.set(project.root, client)
  const controlPath = path.join(project.distRoot, '__weapp_vite_hmr/control.js')
  const control = parseStatefulHmrControlSource(await readFile(controlPath, 'utf8'))
  await client.ensureRegistered(control, scenarioTimeoutMs)
  return client
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

export function isAuditableScriptEntry(sourceRoot: string, filePath: string) {
  if (!isEntryLikeSource(sourceRoot, filePath)) {
    return false
  }
  if (!isScriptEntryFile(filePath)) {
    return false
  }

  const relative = normalizePath(path.relative(sourceRoot, filePath))
  if (relative.startsWith('components/')) {
    return isSidecarEntryFile(filePath)
  }

  return true
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

function findPreferredSource(files: string[], predicate: (filePath: string) => boolean) {
  return files.find(filePath => predicate(filePath) && !isLowSignalAuditSource(filePath))
    ?? files.find(predicate)
}

function findPreferredVueSource(files: string[], sourceRoot: string) {
  const candidates = files.filter(filePath => filePath.endsWith('/index.vue') && isPageLikeSource(sourceRoot, filePath))
  return candidates
    .filter(filePath => !isLowSignalAuditSource(filePath))
    .sort((left, right) => scoreVueAuditSource(sourceRoot, left) - scoreVueAuditSource(sourceRoot, right)
      || left.localeCompare(right),
    )[0]
    ?? candidates[0]
}

function scoreVueAuditSource(sourceRoot: string, filePath: string) {
  const relative = normalizePath(path.relative(sourceRoot, filePath))
  const size = statSyncSize(filePath)
  const segmentScore = relative.startsWith('pages/')
    ? relative.startsWith('pages/index/')
      ? 1
      : 0
    : relative.startsWith('subpackages/')
      ? 2
      : 3
  return segmentScore * 1_000_000 + size
}

function statSyncSize(filePath: string) {
  try {
    return existsSync(filePath) ? statSync(filePath).size : Number.MAX_SAFE_INTEGER
  }
  catch {
    return Number.MAX_SAFE_INTEGER
  }
}

function isLowSignalAuditSource(filePath: string) {
  return normalizePath(filePath).split('/').includes('blank')
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

async function waitForStableDistSnapshot(
  distRoot: string,
  stableMs: number,
  timeoutMs: number,
) {
  const startedAt = Date.now()
  let previousSignature: string | undefined
  let stableStartedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await snapshotDist(distRoot)
    const signature = createDistSnapshotSignature(snapshot)

    if (signature === previousSignature) {
      if (Date.now() - stableStartedAt >= stableMs) {
        return snapshot
      }
    }
    else {
      previousSignature = signature
      stableStartedAt = Date.now()
    }

    await sleep(Math.min(250, stableMs))
  }

  throw new Error(`Timed out waiting for ${formatReportPath(distRoot)} to stabilize`)
}

function createDistSnapshotSignature(snapshot: Map<string, DistFileSnapshot>) {
  return [...snapshot.entries()]
    .map(([filePath, value]) => `${filePath}:${value.hash}:${value.size}`)
    .join('\n')
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
      return withScenarioProfileFallback(project, candidates[candidates.length - 1]!, sourcePath)
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
  if (isStylesheetOutput(filePath)) {
    await waitForEmittedStylesheet(filePath, marker, { timeoutMs })
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
  if (isStylesheetOutput(filePath)) {
    await waitForEmittedStylesheet(filePath, marker, { absent: true, timeoutMs })
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

function isStylesheetOutput(filename: string) {
  return ['.wxss', '.acss'].includes(path.extname(filename))
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

async function writeScenarioSource(filePath: string, content: string) {
  if (writeMode === 'rename') {
    await replaceFileByRename(filePath, content)
    return
  }
  await writeFile(filePath, content, 'utf8')
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

export function readWorkspaceHmrScope(raw: string | undefined): WorkspaceHmrScope {
  if (!raw) {
    return 'workspace'
  }
  if (raw === 'apps,e2e-apps' || raw === 'apps' || raw === 'e2e-apps' || raw === 'templates' || raw === 'workspace') {
    return raw
  }
  throw new Error(`Invalid WORKSPACE_HMR_SCOPE: ${raw}`)
}

export function readWorkspaceHmrWriteMode(raw: string | undefined): WorkspaceHmrWriteMode {
  if (!raw) {
    return 'write'
  }
  if (raw === 'write' || raw === 'rename') {
    return raw
  }
  throw new Error(`Invalid WORKSPACE_HMR_WRITE_MODE: ${raw}`)
}

export function readWorkspaceHmrPollingMode(raw: string | undefined): WorkspaceHmrPollingMode {
  if (!raw || raw === '0' || raw === 'false') {
    return 'native'
  }
  if (raw === '1' || raw === 'true') {
    return 'polling'
  }
  throw new Error(`Invalid WORKSPACE_HMR_USE_POLLING: ${raw}`)
}

function rootsForScope(scope: WorkspaceHmrScope): readonly WorkspaceHmrProjectKind[] {
  if (scope === 'apps,e2e-apps') {
    return ['apps', 'e2e-apps']
  }
  if (scope === 'workspace') {
    return ROOTS
  }
  return [scope]
}

function isWorkspaceHmrProjectKind(value: string): value is WorkspaceHmrProjectKind {
  return value === 'apps' || value === 'templates' || value === 'e2e-apps'
}

export function selectWorkspaceHmrSmokeProjectIds(
  projects: Array<{ id: string, kind: WorkspaceHmrProjectKind }>,
  scope: WorkspaceHmrScope,
) {
  const selected = new Set<string>()
  for (const kind of rootsForScope(scope)) {
    const project = projects.find(item => item.kind === kind)
    if (project) {
      selected.add(project.id)
    }
  }
  return selected
}

async function readWorkspaceHmrBaseline(filePath: string): Promise<WorkspaceHmrBaseline | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as WorkspaceHmrBaseline
}

interface WorkspaceHmrReportSummary {
  projectCount: number
  failedProjectCount: number
  scenarioCount: number
  measuredScenarioCount: number
  executedScenarioCount: number
  successfulScenarioCount: number
  failedScenarioCount: number
  notExecutedScenarioCount: number
  compilerProfileSampleCount: number
  scenarioP50Ms?: number
  scenarioP95Ms?: number
  scenarioMaxMs?: number
  failedProjects: string[]
}

interface WorkspaceHmrFinding {
  project: string
  scenario?: string
  metric: string
  value: string
  suggestion: string
}

interface WorkspaceHmrSlowScenario {
  project: string
  scenario: ScenarioResult
  startupMs?: number
  topPhase: string
  topPhaseMs?: number
}

const FINDING_MAX_ROWS = 12
const SLOW_SCENARIO_MAX_ROWS = 8
const SLOW_STARTUP_MS = 10_000
const SLOW_SCENARIO_MS = 1_000
const HIGH_PENDING_COUNT = 12
const HIGH_EMITTED_COUNT = 12
const HIGH_IMPACT_FILE_COUNT = 8

function summarizeProjectResults(results: ProjectResult[]): WorkspaceHmrReportSummary {
  const measuredScenarioMs = results
    .flatMap(project => project.scenarios.map(scenario => scenario.totalMs))
    .filter((value): value is number => typeof value === 'number')
  const failedProjects = results
    .filter(project => project.error || project.scenarios.some(scenario => scenario.error))
    .map(project => project.id)

  return {
    projectCount: results.length,
    failedProjectCount: failedProjects.length,
    ...summarizeWorkspaceHmrExecution(results),
    scenarioCount: results.reduce((count, project) => count + project.scenarios.length, 0),
    measuredScenarioCount: measuredScenarioMs.length,
    scenarioP50Ms: percentile(measuredScenarioMs, 0.5),
    scenarioP95Ms: percentile(measuredScenarioMs, 0.95),
    scenarioMaxMs: measuredScenarioMs.length ? Math.max(...measuredScenarioMs) : undefined,
    failedProjects,
  }
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) {
    return undefined
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.ceil(sorted.length * percentileValue) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]
}

function formatMetric(value: number | undefined) {
  if (value == null) {
    return '-'
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatDuration(value: number | undefined) {
  return value == null ? '-' : `${formatMetric(value)}ms`
}

export function collectWorkspaceHmrTopSlowScenarios(results: ProjectResult[], limit = SLOW_SCENARIO_MAX_ROWS): WorkspaceHmrSlowScenario[] {
  return results
    .flatMap(project => project.scenarios
      .filter(scenario => typeof scenario.totalMs === 'number')
      .map((scenario) => {
        const topPhase = dominantPhaseMetric(scenario)
        return {
          project: project.id,
          scenario,
          startupMs: project.startupMs,
          topPhase: topPhase.phase,
          topPhaseMs: topPhase.ms,
        }
      }))
    .sort((left, right) => (right.scenario.totalMs ?? 0) - (left.scenario.totalMs ?? 0))
    .slice(0, limit)
}

function collectActionableFindings(results: ProjectResult[], summary: WorkspaceHmrReportSummary): WorkspaceHmrFinding[] {
  const findings: WorkspaceHmrFinding[] = []
  const slowScenarioLimit = Math.max(SLOW_SCENARIO_MS, summary.scenarioP95Ms ?? 0)

  for (const project of results) {
    if (project.error) {
      findings.push({
        project: project.id,
        metric: 'project-error',
        value: project.error,
        suggestion: '先检查项目启动、入口发现和初始 dist 产物；若是审计误选入口，收紧场景发现规则。',
      })
    }
    if ((project.startupMs ?? 0) > SLOW_STARTUP_MS) {
      findings.push({
        project: project.id,
        metric: 'startupMs',
        value: formatDuration(project.startupMs),
        suggestion: '启动阶段偏慢，优先检查依赖扫描、Tailwind/Vite 插件初始化和首轮 dist 稳定等待。',
      })
    }

    for (const scenario of project.scenarios) {
      if (scenario.error) {
        findings.push({
          project: project.id,
          scenario: scenario.id,
          metric: 'scenario-error',
          value: scenario.error,
          suggestion: '先确认源文件 mutation 是否命中真实产物，再检查 profile 样本归因。',
        })
      }
      if ((scenario.totalMs ?? 0) > slowScenarioLimit) {
        findings.push({
          project: project.id,
          scenario: scenario.id,
          metric: 'totalMs',
          value: formatDuration(scenario.totalMs),
          suggestion: dominantPhaseSuggestion(scenario),
        })
      }
      if ((scenario.profile?.pendingCount ?? 0) > HIGH_PENDING_COUNT || (scenario.profile?.emittedCount ?? 0) > HIGH_EMITTED_COUNT) {
        findings.push({
          project: project.id,
          scenario: scenario.id,
          metric: 'pending/emitted',
          value: `${scenario.profile?.pendingCount ?? '-'} / ${scenario.profile?.emittedCount ?? '-'}`,
          suggestion: sharedChunkSuggestion(scenario),
        })
      }
      if ((scenario.impact?.length ?? 0) > HIGH_IMPACT_FILE_COUNT) {
        findings.push({
          project: project.id,
          scenario: scenario.id,
          metric: 'impactFiles',
          value: String(scenario.impact?.length ?? 0),
          suggestion: '影响文件偏多，检查入口依赖是否触发共享 chunk、全局配置或多分包产物刷新。',
        })
      }
    }
  }

  return findings
    .sort((left, right) => findingSeverity(right) - findingSeverity(left))
    .slice(0, FINDING_MAX_ROWS)
}

function findingSeverity(finding: WorkspaceHmrFinding) {
  const parsed = Number.parseFloat(finding.value)
  const numeric = Number.isFinite(parsed) ? parsed : 0
  if (finding.metric === 'project-error' || finding.metric === 'scenario-error') {
    return 1_000_000
  }
  if (finding.metric === 'totalMs' || finding.metric === 'startupMs') {
    return numeric
  }
  if (finding.metric === 'pending/emitted') {
    return 500 + numeric
  }
  return numeric
}

function dominantPhaseSuggestion(scenario: ScenarioResult) {
  const { phase } = dominantPhaseMetric(scenario)

  if (phase === 'transform') {
    return 'transform 阶段偏慢，优先检查 Vue/SFC 编译、Tailwind 类扫描和脚本依赖转换。'
  }
  if (phase === 'write') {
    return '写盘阶段偏慢，检查 impact 文件数量、dist 输出体积和是否存在无关产物刷新。'
  }
  if (phase === 'emit') {
    return 'emit 阶段偏慢，检查入口数量、组件自动导入和额外资产发射。'
  }
  return 'build 阶段偏慢，优先检查共享 chunk 影响面、页面依赖图和 Vite/Rolldown 增量缓存。'
}

function dominantPhaseMetric(scenario: ScenarioResult) {
  const profile = scenario.profile
  const phases = [
    ['build', profile?.buildCoreMs],
    ['transform', profile?.transformMs],
    ['core-transform', profile?.coreTransformMs],
    ['wevu-transform', profile?.wevuTransformMs],
    ['vue-transform', profile?.vueTransformMs],
    ['bundler', profile?.bundlerMs],
    ['render-start', profile?.renderStartMs],
    ['generate-bundle', profile?.generateBundleMs],
    ['generate-shared', profile?.generateSharedMs],
    ['generate-rewrite', profile?.generateRewriteMs],
    ['generate-module-graph', profile?.generateModuleGraphMs],
    ['snapshot-resolve', profile?.snapshotResolveMs],
    ['snapshot-build', profile?.snapshotBuildMs],
    ['write', profile?.writeMs],
    ['emit', profile?.emitMs],
  ] as const
  const [phase, ms] = phases
    .filter((item): item is [typeof phases[number][0], number] => typeof item[1] === 'number')
    .sort((left, right) => right[1] - left[1])[0] ?? ['total', scenario.totalMs]

  return {
    phase,
    ms,
  }
}

function sharedChunkSuggestion(scenario: ScenarioResult) {
  const reasons = scenario.profile?.pendingReasonSummary ?? []
  if (reasons.some(reason => reason.startsWith('shared-chunk('))) {
    return '共享 chunk 扩展导致影响面偏大；可先确认项目是否能接受 `weapp.hmr.sharedChunks: "off"` 的开发态速度取舍，默认 `auto` 更偏正确性。'
  }
  return 'pending/emitted 偏高，检查 dirty reason、自动路由/layout 传播或是否发生全量入口刷新。'
}

async function writeGitHubStepSummary(results: ProjectResult[], summary: WorkspaceHmrReportSummary, thresholdMarkdown: string) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) {
    return
  }
  const failedProjects = results.filter(project => project.error || project.scenarios.some(scenario => scenario.error))
  const slowScenarios = collectWorkspaceHmrTopSlowScenarios(results, 5)
  const lines = [
    '## Workspace HMR Audit',
    '',
    `- mode: ${runMode}`,
    `- scope: ${workspaceHmrScope}`,
    `- selection: ${results.length ? 'selected' : 'empty (no acceptance results)'}`,
    `- projects: ${summary.projectCount}`,
    ...renderWorkspaceHmrExecution(summary, summary.scenarioCount),
    `- timing threshold samples: ${summary.measuredScenarioCount}/${summary.scenarioCount}`,
    `- scenario P95: ${formatDuration(summary.scenarioP95Ms)}`,
    `- scenario max: ${formatDuration(summary.scenarioMaxMs)}`,
    `- failures: ${failedProjects.length}`,
    `- report: ${formatReportPath(reportMdPath)}`,
    `- report json: ${formatReportPath(reportJsonPath)}`,
    `- thresholds: ${formatReportPath(thresholdMdPath)}`,
    '',
  ]
  if (slowScenarios.length) {
    lines.push('### Top Slow Scenarios', '')
    lines.push('| project | scenario | total | startup | pending/emitted | top phase |')
    lines.push('| --- | --- | ---: | ---: | ---: | --- |')
    for (const item of slowScenarios) {
      lines.push([
        item.project,
        item.scenario.id,
        formatDuration(item.scenario.totalMs),
        formatDuration(item.startupMs),
        `${item.scenario.profile?.pendingCount ?? '-'} / ${item.scenario.profile?.emittedCount ?? '-'}`,
        `${item.topPhase} ${formatDuration(item.topPhaseMs)}`,
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
    lines.push('')
  }
  lines.push(thresholdMarkdown, '')
  await appendFile(summaryPath, `${lines.join('\n')}\n`, 'utf8')
}

function renderMarkdown(results: ProjectResult[], summary: WorkspaceHmrReportSummary, thresholdMarkdown: string) {
  const findings = collectActionableFindings(results, summary)
  const slowScenarios = collectWorkspaceHmrTopSlowScenarios(results)
  const lines = [
    '# Workspace HMR Audit',
    '',
    `- mode: ${runMode}`,
    `- scope: ${workspaceHmrScope}`,
    `- selection: ${results.length ? 'selected' : 'empty (no acceptance results)'}`,
    `- generated projects: ${summary.projectCount}`,
    ...renderWorkspaceHmrExecution(summary, summary.scenarioCount),
    `- timing threshold samples: ${summary.measuredScenarioCount}/${summary.scenarioCount}`,
    `- scenario P50: ${formatDuration(summary.scenarioP50Ms)}`,
    `- scenario P95: ${formatDuration(summary.scenarioP95Ms)}`,
    `- scenario max: ${formatDuration(summary.scenarioMaxMs)}`,
    `- failed projects: ${summary.failedProjects.length ? summary.failedProjects.join(', ') : '-'}`,
    `- baseline: ${pathExistsSyncLike(baselinePath) ? formatReportPath(baselinePath) : '-'}`,
    `- startup timeout: ${startupTimeoutMs}ms`,
    `- startup dist stable: ${startupDistStableMs}ms`,
    `- scenario timeout: ${scenarioTimeoutMs}ms`,
    `- scenario retries: ${scenarioRetries}`,
    `- write mode: ${writeMode}`,
    `- watch mode: ${pollingMode}`,
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
  lines.push('## Top Slow Scenarios', '')
  if (!slowScenarios.length) {
    lines.push('No timing threshold samples.', '')
  }
  else {
    lines.push('| project | scenario | total | observed | startup | pending/emitted | impact | top phase | suggestion |')
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |')
    for (const item of slowScenarios) {
      lines.push([
        item.project,
        item.scenario.id,
        formatDuration(item.scenario.totalMs),
        formatDuration(item.scenario.observedMs),
        formatDuration(item.startupMs),
        `${item.scenario.profile?.pendingCount ?? '-'} / ${item.scenario.profile?.emittedCount ?? '-'}`,
        String(item.scenario.impact?.length ?? 0),
        `${item.topPhase} ${formatDuration(item.topPhaseMs)}`,
        dominantPhaseSuggestion(item.scenario),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
    lines.push('')
  }
  lines.push('## Actionable Findings', '')
  if (!findings.length) {
    lines.push('No actionable HMR findings detected by the report heuristics.', '')
  }
  else {
    lines.push('| project | scenario | metric | value | suggestion |')
    lines.push('| --- | --- | --- | ---: | --- |')
    for (const finding of findings) {
      lines.push([
        finding.project,
        finding.scenario ?? '-',
        finding.metric,
        finding.value,
        finding.suggestion,
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
    lines.push('')
  }
  for (const project of results) {
    lines.push(`## ${project.id}`, '')
    if (project.error) {
      lines.push(`- project error: ${project.error}`, '')
      continue
    }
    if (project.warmup) {
      lines.push(`- warmup delivery: ${project.warmup.update?.delivery ?? '-'}; restore: ${project.warmup.restore?.delivery ?? '-'}`, '')
    }
    lines.push('| scenario | delivery | restore | total(ms) | observed(ms) | build(ms) | transform(ms) | write(ms) | emit(ms) | dirty | pending | emitted | impact | error |')
    lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |')
    for (const scenario of project.scenarios) {
      lines.push([
        scenario.id,
        scenario.delivery ?? '-',
        scenario.restoreDelivery?.delivery ?? '-',
        formatMetric(scenario.totalMs),
        formatMetric(scenario.observedMs),
        formatMetric(scenario.profile?.buildCoreMs),
        formatMetric(scenario.profile?.transformMs),
        formatMetric(scenario.profile?.writeMs),
        formatMetric(scenario.profile?.emitMs),
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
