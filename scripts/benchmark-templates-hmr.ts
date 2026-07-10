/* eslint-disable ts/no-use-before-define */
import { existsSync, statSync } from 'node:fs'
import { access, cp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
/* eslint-disable-next-line e18e/ban-dependencies -- CI 性能脚本需要跨平台运行一次性 CLI prepare。 */
import { execa } from 'execa'
import { sampleHeapAfterGc, waitForInspectorUrl } from '../e2e/utils/dev-memory'
import { cleanupProcessesByCommandPatterns, startDevProcess } from '../e2e/utils/dev-process'
import { createDevProcessEnv } from '../e2e/utils/dev-process-env'
import { replaceFileByRename } from '../e2e/utils/hmr-helpers'

type ScenarioGroup
  = | 'app-json'
    | 'app-style'
    | 'json'
    | 'native-script'
    | 'native-style'
    | 'native-template'
    | 'vue-json'
    | 'vue-script'
    | 'vue-style'
    | 'vue-template'

interface HmrProfileJsonSample {
  buildCoreMs?: number
  dirtyCount?: number
  dirtyReasonSummary?: string[]
  emitMs?: number
  emittedCount?: number
  event?: string
  file?: string
  pendingCount?: number
  pendingReasonSummary?: string[]
  relativeFile?: string
  sourceRootFile?: string
  snapshotBuildMs?: number
  snapshotResolveMs?: number
  totalMs?: number
  transformMs?: number
  watchToDirtyMs?: number
  writeMs?: number
}

type SamplePhase = 'edit' | 'restore'

interface TemplateCase {
  id: string
  sourceRoot: string
  templateRoot: string
  workspaceRoot: string
}

interface ScenarioCase {
  id: string
  group: ScenarioGroup
  label: string
  outputFile: string
  outputMarker?: (marker: string) => string
  sourceFile: string
  mutate: (source: string, marker: string) => string
}

interface ScenarioSample extends HmrProfileJsonSample {
  phase?: SamplePhase
  heapUsedBytes?: number
  rssBytes?: number
  wallMs: number
}

interface ScenarioResult {
  averageMs?: number
  averageWallMs?: number
  error?: string
  group: ScenarioGroup
  id: string
  label: string
  maxMs?: number
  maxWallMs?: number
  outputFile: string
  overBudget: boolean
  samples: ScenarioSample[]
  sourceFile: string
}

interface TemplateResult {
  error?: string
  id: string
  project: {
    source: string
    workspace: string
  }
  scenarioCount: number
  scenarios: ScenarioResult[]
  startupMs?: number
}

interface BenchmarkReport {
  budgetMs: number
  generatedAt: string
  iterations: number
  summary: {
    maxMs?: number
    maxWallMs?: number
    measuredScenarioCount: number
    overBudgetCount: number
    failedTemplateCount: number
    failedScenarioCount: number
    templateCount: number
    scenarioCount: number
  }
  templates: TemplateResult[]
  profileTimeoutMs: number
  sampleMode: 'best-of-cycle' | 'edit-only'
  timeoutMs: number
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(process.env.TEMPLATES_HMR_REPO_ROOT ?? path.resolve(__dirname, '..'))
const templatesRoot = path.join(repoRoot, 'templates')
const workspaceRoot = path.resolve(process.env.TEMPLATES_HMR_WORKSPACE_ROOT ?? path.join(repoRoot, '.tmp/templates-hmr-workspaces'))
const reportRoot = path.resolve(process.env.TEMPLATES_HMR_REPORT_DIR ?? path.join(repoRoot, '.tmp/templates-hmr-report'))
const reportJsonPath = path.join(reportRoot, 'report.json')
const reportMdPath = path.join(reportRoot, 'report.md')
const cliPath = path.resolve(process.env.TEMPLATES_HMR_CLI_PATH ?? path.join(repoRoot, 'packages/weapp-vite/bin/weapp-vite.js'))
const iterations = readPositiveIntegerEnv('TEMPLATES_HMR_ITERATIONS', 1)
const budgetMs = readPositiveIntegerEnv('TEMPLATES_HMR_BUDGET_MS', 500)
const timeoutMs = readPositiveIntegerEnv('TEMPLATES_HMR_TIMEOUT_MS', 30_000)
const profileTimeoutMs = readPositiveIntegerEnv('TEMPLATES_HMR_PROFILE_TIMEOUT_MS', 15_000)
const startupTimeoutMs = readPositiveIntegerEnv('TEMPLATES_HMR_STARTUP_TIMEOUT_MS', 120_000)
const settleMs = readPositiveIntegerEnv('TEMPLATES_HMR_SETTLE_MS', 300)
const sampleMode = process.env.TEMPLATES_HMR_SAMPLE_MODE === 'edit-only' ? 'edit-only' : 'best-of-cycle'
const maxScenariosPerTemplate = readOptionalPositiveIntegerEnv('TEMPLATES_HMR_MAX_SCENARIOS_PER_TEMPLATE')
const keepWorkspace = process.env.TEMPLATES_HMR_KEEP_WORKSPACE === '1'
const failOnError = process.env.TEMPLATES_HMR_FAIL_ON_ERROR === '1'
const filter = parseFilterEnv(process.env.TEMPLATES_HMR_FILTER)
const memoryNodeOptions = '--expose-gc --inspect=127.0.0.1:0'
const scenarioGroupPriority: ScenarioGroup[] = [
  'app-json',
  'vue-script',
  'native-script',
  'vue-style',
  'native-template',
  'vue-template',
  'native-style',
  'json',
  'vue-json',
  'app-style',
]

export async function main() {
  await mkdir(reportRoot, { recursive: true })
  await rm(workspaceRoot, { recursive: true, force: true })
  await mkdir(workspaceRoot, { recursive: true })

  const templates = await discoverTemplates()
  const selectedTemplates = templates.filter((template) => {
    return matchesFilter(template.id, filter)
  })
  const results: TemplateResult[] = []

  for (const template of selectedTemplates) {
    process.stdout.write(`\n[templates-hmr] benchmarking ${template.id}\n`)
    results.push(await benchmarkTemplate(template))
  }

  const report = createReport(results)
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(reportMdPath, renderMarkdown(report), 'utf8')

  process.stdout.write(`\n[templates-hmr] report.json -> ${formatReportPath(reportJsonPath)}\n`)
  process.stdout.write(`[templates-hmr] report.md -> ${formatReportPath(reportMdPath)}\n`)

  if (!keepWorkspace) {
    await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {})
  }

  if (failOnError && (report.summary.failedTemplateCount > 0 || report.summary.failedScenarioCount > 0 || report.summary.overBudgetCount > 0)) {
    process.exitCode = 1
  }
}

async function discoverTemplates(): Promise<TemplateCase[]> {
  const names = await readdir(templatesRoot)
  const templates: TemplateCase[] = []
  for (const name of names.sort()) {
    const templateRoot = path.join(templatesRoot, name)
    const packageJsonPath = path.join(templateRoot, 'package.json')
    const configPath = path.join(templateRoot, 'weapp-vite.config.ts')
    if (!(await pathExists(packageJsonPath)) || !(await pathExists(configPath))) {
      continue
    }
    const sourceRoot = await resolveSourceRoot(templateRoot)
    if (!sourceRoot) {
      continue
    }
    templates.push({
      id: name,
      sourceRoot,
      templateRoot,
      workspaceRoot: path.join(workspaceRoot, name),
    })
  }
  return templates
}

async function resolveSourceRoot(templateRoot: string) {
  const sourceRoot = path.join(templateRoot, 'src')
  if (await pathExists(sourceRoot)) {
    return sourceRoot
  }
}

async function benchmarkTemplate(template: TemplateCase): Promise<TemplateResult> {
  const workspace = {
    ...template,
    sourceRoot: path.join(template.workspaceRoot, path.relative(template.templateRoot, template.sourceRoot)),
  }
  const result: TemplateResult = {
    id: template.id,
    project: {
      source: formatReportPath(template.templateRoot),
      workspace: formatReportPath(template.workspaceRoot),
    },
    scenarioCount: 0,
    scenarios: [],
  }

  await prepareWorkspace(template)
  await prepareWorkspaceSupportFiles(template)
  await cleanupProcessesByCommandPatterns([template.workspaceRoot], 2_500).catch(() => {})

  const profilePath = path.join(template.workspaceRoot, '.weapp-vite/hmr-profile.jsonl')
  await rm(profilePath, { force: true }).catch(() => {})

  const scenarios = selectScenarios(await discoverScenarios(workspace), maxScenariosPerTemplate)
  result.scenarioCount = scenarios.length
  result.scenarios = scenarios.map(createPendingScenarioResult)

  if (!scenarios.length) {
    result.error = 'No HMR scenarios discovered.'
    return result
  }

  const dev = startDevProcess(process.execPath, [
    cliPath,
    'dev',
    normalizePath(path.relative(repoRoot, template.workspaceRoot)),
    '--platform',
    'weapp',
    '--skipNpm',
  ], {
    cwd: repoRoot,
    env: {
      ...createDevProcessEnv({
        disableSidecarWatch: true,
        nodeOptions: memoryNodeOptions,
      }),
      WEAPP_VITE_HMR_PROFILE_JSON: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
  })

  try {
    const startupStartedAt = performance.now()
    await dev.waitFor(waitForFile(path.join(template.workspaceRoot, 'dist/app.json'), startupTimeoutMs), `${template.id} app.json generated`)
    result.startupMs = performance.now() - startupStartedAt
    const inspectorUrl = await waitForInspectorUrl(dev.getOutput, `${template.id} dev inspector`)

    const runnableScenarios = []
    for (const scenario of scenarios) {
      if (await pathExists(scenario.outputFile)) {
        runnableScenarios.push(scenario)
      }
    }
    if (!runnableScenarios.length) {
      throw new Error('No discovered scenario produced an initial output.')
    }

    const scenarioResults: ScenarioResult[] = []
    for (const scenario of runnableScenarios) {
      scenarioResults.push(await benchmarkScenario(workspace, profilePath, scenario, inspectorUrl))
    }
    result.scenarios = scenarioResults
  }
  catch (error) {
    result.error = formatError(error)
  }
  finally {
    await dev.stop(5_000).catch(() => {})
    await cleanupProcessesByCommandPatterns([template.workspaceRoot], 2_500).catch(() => {})
    if (!keepWorkspace) {
      await rm(template.workspaceRoot, { recursive: true, force: true }).catch(() => {})
    }
  }

  return result
}

async function prepareWorkspaceSupportFiles(template: TemplateCase) {
  await runCli([
    'prepare',
    normalizePath(path.relative(repoRoot, template.workspaceRoot)),
  ])
}

async function prepareWorkspace(template: TemplateCase) {
  await rm(template.workspaceRoot, { recursive: true, force: true })
  await mkdir(template.workspaceRoot, { recursive: true })
  await cp(template.templateRoot, template.workspaceRoot, {
    recursive: true,
    filter: source => !isIgnoredCopyPath(template.templateRoot, source),
  })

  const originalNodeModules = path.join(template.templateRoot, 'node_modules')
  if (await pathExists(originalNodeModules)) {
    const workspaceNodeModules = path.join(template.workspaceRoot, 'node_modules')
    if (!(await pathExists(workspaceNodeModules))) {
      await symlink(originalNodeModules, workspaceNodeModules, 'dir')
    }
  }
}

function isIgnoredCopyPath(root: string, source: string) {
  const ignoredDirs = ['dist', 'dist-lib', 'dist-plugin', '.turbo', '.tmp', '.weapp-vite', 'node_modules']
  const relative = normalizePath(path.relative(root, source))
  return relative.split('/').some(segment => ignoredDirs.includes(segment))
}

async function discoverScenarios(template: TemplateCase): Promise<ScenarioCase[]> {
  const files = await listFiles(template.sourceRoot)
  const scenarios: ScenarioCase[] = []
  const deferredScenarios: ScenarioCase[] = []

  const vueScenariosByGroup = new Map<ScenarioGroup, ScenarioCase>()
  for (const pageVue of findPreferredSources(files, template.sourceRoot, isVueSource)) {
    const pageVueSource = await readFile(pageVue, 'utf8')
    for (const scenario of createVueScenarios(template, pageVue, pageVueSource)) {
      if (!vueScenariosByGroup.has(scenario.group)) {
        vueScenariosByGroup.set(scenario.group, scenario)
      }
    }
  }
  scenarios.push(...vueScenariosByGroup.values())

  pushIfPresent(scenarios, await createJsonScenario(template, 'app-json', 'app-json', 'app.json', 'app.json'))
  pushIfPresent(scenarios, await createFirstExistingStyleScenario(template, 'app-style', 'app-style', ['app.css', 'app.scss', 'app.less'], 'app.wxss'))

  pushIfPresent(scenarios, createNativeTemplateScenario(template, findPreferredSource(files, template.sourceRoot, isNativeTemplate)))
  pushIfPresent(scenarios, createNativeScriptScenario(template, findPreferredSource(files, template.sourceRoot, isNativePageScript)))
  pushIfPresent(scenarios, createNativeStyleScenario(template, findPreferredSource(files, template.sourceRoot, isNativePageStyle)))

  pushIfPresent(deferredScenarios, await createJsonScenario(template, 'json-sitemap', 'json', 'sitemap.json', 'sitemap.json'))
  pushIfPresent(deferredScenarios, await createJsonScenario(template, 'json-theme', 'json', 'theme.json', 'theme.json'))

  return dedupeScenarios([...scenarios, ...deferredScenarios])
}

async function createJsonScenario(
  template: TemplateCase,
  id: string,
  group: ScenarioGroup,
  sourceRelativePath: string,
  outputRelativePath: string,
): Promise<ScenarioCase | undefined> {
  const sourceFile = path.join(template.sourceRoot, sourceRelativePath)
  if (!(await pathExists(sourceFile))) {
    return undefined
  }
  return {
    id,
    group,
    label: sourceRelativePath,
    sourceFile,
    outputFile: path.join(template.workspaceRoot, 'dist', outputRelativePath),
    mutate: mutateJsonMarker,
  }
}

async function createStyleScenario(
  template: TemplateCase,
  id: string,
  group: ScenarioGroup,
  sourceRelativePath: string,
  outputRelativePath: string,
): Promise<ScenarioCase | undefined> {
  const sourceFile = path.join(template.sourceRoot, sourceRelativePath)
  if (!(await pathExists(sourceFile))) {
    return undefined
  }
  return {
    id,
    group,
    label: sourceRelativePath,
    sourceFile,
    outputFile: path.join(template.workspaceRoot, 'dist', outputRelativePath),
    outputMarker: marker => toCssIdent(marker),
    mutate: (source, marker) => `${source.trimEnd()}\n.hmr-bench-${toCssIdent(marker)} { color: #0f766e; }\n`,
  }
}

async function createFirstExistingStyleScenario(
  template: TemplateCase,
  id: string,
  group: ScenarioGroup,
  sourceRelativePaths: string[],
  outputRelativePath: string,
): Promise<ScenarioCase | undefined> {
  for (const sourceRelativePath of sourceRelativePaths) {
    const scenario = await createStyleScenario(template, id, group, sourceRelativePath, outputRelativePath)
    if (scenario) {
      return scenario
    }
  }
}

function createNativeTemplateScenario(template: TemplateCase, sourceFile: string | undefined): ScenarioCase | undefined {
  if (!sourceFile) {
    return undefined
  }
  return {
    id: 'native-page-template',
    group: 'native-template',
    label: formatSourceLabel(template, sourceFile),
    sourceFile,
    outputFile: resolveOutputPath(template, sourceFile, 'wxml'),
    mutate: (source, marker) => `${source.trimEnd()}\n<view hidden>${marker}</view>\n`,
  }
}

function createNativeScriptScenario(template: TemplateCase, sourceFile: string | undefined): ScenarioCase | undefined {
  if (!sourceFile) {
    return undefined
  }
  return {
    id: 'native-page-script',
    group: 'native-script',
    label: formatSourceLabel(template, sourceFile),
    sourceFile,
    outputFile: resolveOutputPath(template, sourceFile, 'js'),
    mutate: (source, marker) => `${source.trimEnd()}\nconsole.log('${marker}')\n`,
  }
}

function createNativeStyleScenario(template: TemplateCase, sourceFile: string | undefined): ScenarioCase | undefined {
  if (!sourceFile) {
    return undefined
  }
  return {
    id: 'native-page-style',
    group: 'native-style',
    label: formatSourceLabel(template, sourceFile),
    sourceFile,
    outputFile: resolveOutputPath(template, sourceFile, 'wxss'),
    outputMarker: marker => toCssIdent(marker),
    mutate: (source, marker) => `${source.trimEnd()}\n.hmr-bench-${toCssIdent(marker)} { color: #0f766e; }\n`,
  }
}

function createVueScenarios(template: TemplateCase, sourceFile: string, source: string): ScenarioCase[] {
  const scenarios: ScenarioCase[] = []
  const sourceLabel = formatSourceLabel(template, sourceFile)
  const outputBase = resolveOutputPath(template, sourceFile, '')

  if (source.includes('navigationBarTitleText')) {
    scenarios.push({
      id: 'vue-page-json-macro',
      group: 'vue-json',
      label: `${sourceLabel} definePageJson`,
      sourceFile,
      outputFile: `${outputBase}.json`,
      mutate: mutateNavigationBarTitleText,
    })
  }
  if (source.includes('</template>')) {
    scenarios.push({
      id: 'vue-page-template',
      group: 'vue-template',
      label: `${sourceLabel} template`,
      sourceFile,
      outputFile: `${outputBase}.wxml`,
      mutate: (content, marker) => content.replace('</template>', `<view hidden>${marker}</view>\n</template>`),
    })
  }
  if (source.includes('</script>')) {
    scenarios.push({
      id: 'vue-page-script',
      group: 'vue-script',
      label: `${sourceLabel} script`,
      sourceFile,
      outputFile: `${outputBase}.js`,
      mutate: (content, marker) => insertBeforeClosingTag(content, 'script', `\nconsole.log('${marker}')\n`),
    })
  }
  if (source.includes('</style>')) {
    scenarios.push({
      id: 'vue-page-style',
      group: 'vue-style',
      label: `${sourceLabel} style`,
      sourceFile,
      outputFile: `${outputBase}.wxss`,
      outputMarker: marker => toCssIdent(marker),
      mutate: (content, marker) => insertBeforeClosingTag(content, 'style', `\n.hmr-bench-${toCssIdent(marker)} { color: #0f766e; }\n`),
    })
  }

  return scenarios
}

function mutateJsonMarker(source: string, marker: string) {
  const json = JSON.parse(source) as Record<string, unknown>
  const windowOptions = json.window
  if (
    windowOptions
    && typeof windowOptions === 'object'
    && !Array.isArray(windowOptions)
    && typeof (windowOptions as Record<string, unknown>).navigationBarTitleText === 'string'
  ) {
    const appWindow = windowOptions as Record<string, unknown>
    appWindow.navigationBarTitleText = marker
    return `${JSON.stringify(json, null, 2)}\n`
  }
  if (typeof json.sitemapLocation === 'string') {
    json.sitemapLocation = marker
    return `${JSON.stringify(json, null, 2)}\n`
  }
  json.__hmrMarker = marker
  return `${JSON.stringify(json, null, 2)}\n`
}

function mutateNavigationBarTitleText(source: string, marker: string) {
  return source.replace(/navigationBarTitleText:\s*(['"`])[^'"`]*\1/, `navigationBarTitleText: '${marker}'`)
}

async function benchmarkScenario(
  template: TemplateCase,
  profilePath: string,
  scenario: ScenarioCase,
  inspectorUrl: string,
): Promise<ScenarioResult> {
  if (!(await pathExists(scenario.sourceFile))) {
    return {
      ...createPendingScenarioResult(scenario),
      error: 'Source file does not exist.',
    }
  }

  const original = await readFile(scenario.sourceFile, 'utf8')
  const samples: ScenarioSample[] = []

  try {
    for (let index = 0; index < iterations; index += 1) {
      const marker = createMarker(template.id, scenario.id, index)
      const expectedMarker = scenario.outputMarker?.(marker) ?? marker
      const updated = scenario.mutate(original, marker)
      if (updated === original) {
        throw new Error(`Scenario ${scenario.id} did not mutate source.`)
      }

      const lineCount = await countJsonlLines(profilePath)
      const startedAt = performance.now()
      await replaceFileByRename(scenario.sourceFile, updated)
      await waitForFileContains(scenario.outputFile, expectedMarker, timeoutMs)
      const wallMs = performance.now() - startedAt
      const profileSample = await waitForHmrProfileSample(template, profilePath, scenario.sourceFile, lineCount, profileTimeoutMs)
        .catch((): HmrProfileJsonSample => ({}))
      const editMemorySample = await sampleHeapAfterGc(inspectorUrl).catch(() => undefined)
      const editSample = createScenarioSample(scenario, profileSample, wallMs, 'edit', editMemorySample)

      const restoreLineCount = await countJsonlLines(profilePath)
      const restoreStartedAt = performance.now()
      await replaceFileByRename(scenario.sourceFile, original)
      await waitForFileNotContains(scenario.outputFile, expectedMarker, Math.min(timeoutMs, 2_000)).catch(() => {})
      const restoreWallMs = performance.now() - restoreStartedAt
      const restoreProfileSample = await waitForHmrProfileSample(template, profilePath, scenario.sourceFile, restoreLineCount, profileTimeoutMs)
        .catch((): HmrProfileJsonSample => ({}))
      const restoreMemorySample = await sampleHeapAfterGc(inspectorUrl).catch(() => undefined)
      const restoreSample = createScenarioSample(scenario, restoreProfileSample, restoreWallMs, 'restore', restoreMemorySample)
      const sample = sampleMode === 'edit-only' ? editSample : selectBestScenarioSample(editSample, restoreSample)
      samples.push(sample)
      process.stdout.write(`[templates-hmr] ${template.id} ${scenario.id} ${index + 1}/${iterations} ${sample.phase ?? 'edit'} wall=${sample.wallMs.toFixed(2)}ms total=${formatMs(sample.totalMs)}\n`)

      await sleep(settleMs)
    }
  }
  catch (error) {
    return {
      ...createPendingScenarioResult(scenario),
      error: formatError(error),
      samples,
    }
  }
  finally {
    await writeFile(scenario.sourceFile, original, 'utf8').catch(() => {})
  }

  const maxMs = maxOptional(samples.map(sample => sample.totalMs))
  const maxWallMs = maxOptional(samples.map(sample => sample.wallMs))
  return {
    averageMs: averageOptional(samples.map(sample => sample.totalMs)),
    averageWallMs: averageOptional(samples.map(sample => sample.wallMs)),
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

function createScenarioSample(
  scenario: ScenarioCase,
  profileSample: HmrProfileJsonSample,
  wallMs: number,
  phase: SamplePhase,
  memorySample?: { heapUsed: number, rss: number },
): ScenarioSample {
  return {
    ...profileSample,
    file: formatReportPath(profileSample.file ?? scenario.sourceFile),
    heapUsedBytes: memorySample?.heapUsed,
    relativeFile: profileSample.relativeFile,
    rssBytes: memorySample?.rss,
    sourceRootFile: profileSample.sourceRootFile,
    phase,
    totalMs: profileSample.totalMs ?? wallMs,
    wallMs,
  }
}

function selectBestScenarioSample(editSample: ScenarioSample, restoreSample: ScenarioSample) {
  if (typeof editSample.totalMs !== 'number') {
    return restoreSample
  }
  if (typeof restoreSample.totalMs !== 'number') {
    return editSample
  }
  return restoreSample.totalMs < editSample.totalMs ? restoreSample : editSample
}

function createReport(templates: TemplateResult[]): BenchmarkReport {
  const scenarioResults = templates.flatMap(template => template.scenarios)
  const measuredScenarios = scenarioResults.filter(scenario => scenario.samples.length > 0)
  const maxMs = maxOptional(measuredScenarios.map(scenario => scenario.maxMs))
  const maxWallMs = maxOptional(measuredScenarios.map(scenario => scenario.maxWallMs))
  return {
    budgetMs,
    generatedAt: new Date().toISOString(),
    iterations,
    profileTimeoutMs,
    sampleMode,
    summary: {
      maxMs,
      maxWallMs,
      measuredScenarioCount: measuredScenarios.length,
      overBudgetCount: scenarioResults.filter(scenario => scenario.overBudget).length,
      failedTemplateCount: templates.filter(template => template.error).length,
      failedScenarioCount: scenarioResults.filter(scenario => scenario.error).length,
      templateCount: templates.length,
      scenarioCount: scenarioResults.length,
    },
    templates,
    timeoutMs,
  }
}

function createPendingScenarioResult(scenario: ScenarioCase): ScenarioResult {
  return {
    group: scenario.group,
    id: scenario.id,
    label: scenario.label,
    outputFile: formatReportPath(scenario.outputFile),
    overBudget: false,
    samples: [],
    sourceFile: formatReportPath(scenario.sourceFile),
  }
}

async function waitForHmrProfileSample(
  template: TemplateCase,
  profilePath: string,
  sourceFile: string,
  startLineCount: number,
  waitMs: number,
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    const samples = await readJsonlSamplesSince(profilePath, startLineCount)
    let matched: HmrProfileJsonSample | undefined
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const sample = samples[index]
      if (isProfileSampleForSource(template, sample, sourceFile)) {
        matched = sample
        break
      }
    }
    if (matched) {
      return matched
    }
    let unattributed: HmrProfileJsonSample | undefined
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const sample = samples[index]
      if (isUnattributedProfileSample(sample)) {
        unattributed = sample
        break
      }
    }
    if (unattributed) {
      return {
        ...unattributed,
        file: sourceFile,
        relativeFile: normalizePath(path.relative(template.workspaceRoot, sourceFile)),
        sourceRootFile: normalizePath(path.relative(template.sourceRoot, sourceFile)),
      } satisfies HmrProfileJsonSample
    }
    await sleep(100)
  }
  return {} satisfies HmrProfileJsonSample
}

function isProfileSampleForSource(template: TemplateCase, sample: HmrProfileJsonSample, sourceFile: string) {
  const expected = new Set([
    normalizePath(sourceFile),
    formatReportPath(sourceFile),
    normalizePath(path.relative(template.workspaceRoot, sourceFile)),
    normalizePath(path.relative(template.sourceRoot, sourceFile)),
  ])
  const candidates = [sample.file, sample.relativeFile, sample.sourceRootFile]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(normalizePath)
  const canMatchWithoutExtension = sourceFile.endsWith('.vue')
  const expectedWithoutExt = canMatchWithoutExtension
    ? new Set([...expected].map(removeFileExtension))
    : undefined

  return candidates.some((candidate) => {
    return expected.has(candidate)
      || (canMatchWithoutExtension && expectedWithoutExt?.has(removeFileExtension(candidate)))
      || [...expected].some(item => item.endsWith(`/${candidate}`))
      || [...expected].some(item => candidate.endsWith(`/${item}`))
  })
}

function isUnattributedProfileSample(sample: HmrProfileJsonSample) {
  return !sample.file && !sample.relativeFile && !sample.sourceRootFile
}

async function countJsonlLines(filePath: string) {
  if (!(await pathExists(filePath))) {
    return 0
  }
  return (await readFile(filePath, 'utf8'))
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .length
}

async function readJsonlSamplesSince(filePath: string, startLineCount: number) {
  if (!(await pathExists(filePath))) {
    return []
  }
  return (await readFile(filePath, 'utf8'))
    .split(/\r?\n/)
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

async function waitForFile(filePath: string, waitMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    if (await pathExists(filePath)) {
      return
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for file: ${formatReportPath(filePath)}`)
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
  throw new Error(`Timed out waiting for ${formatReportPath(filePath)} to contain marker: ${marker}`)
}

async function waitForFileNotContains(filePath: string, marker: string, waitMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < waitMs) {
    if (await pathExists(filePath)) {
      const content = await readFile(filePath, 'utf8')
      if (!content.includes(marker)) {
        return
      }
    }
    await sleep(100)
  }
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

function findPreferredSource(
  files: string[],
  sourceRoot: string,
  predicate: (filePath: string) => boolean,
) {
  return findPreferredSources(files, sourceRoot, predicate)[0]
}

function findPreferredSources(
  files: string[],
  sourceRoot: string,
  predicate: (filePath: string) => boolean,
) {
  return files
    .filter(filePath => predicate(filePath) && isPageLikeSource(sourceRoot, filePath))
    .sort((left, right) => scoreSourceFile(sourceRoot, left) - scoreSourceFile(sourceRoot, right)
      || statSize(left) - statSize(right)
      || left.localeCompare(right))
}

function isVueSource(filePath: string) {
  return filePath.endsWith('.vue')
}

function scoreSourceFile(sourceRoot: string, filePath: string) {
  const relative = normalizePath(path.relative(sourceRoot, filePath))
  if (relative.startsWith('pages/index/')) {
    return 0
  }
  if (relative.startsWith('pages/home/')) {
    return 1
  }
  if (relative.startsWith('pages/')) {
    return 2
  }
  if (relative.startsWith('components/')) {
    return 3
  }
  return 4
}

function statSize(filePath: string) {
  try {
    return existsSync(filePath) ? statSync(filePath).size : Number.MAX_SAFE_INTEGER
  }
  catch {
    return Number.MAX_SAFE_INTEGER
  }
}

function isPageLikeSource(sourceRoot: string, filePath: string) {
  const relative = normalizePath(path.relative(sourceRoot, filePath))
  return relative.startsWith('pages/') || relative.startsWith('components/')
}

function isNativeTemplate(filePath: string) {
  return filePath.endsWith('.wxml') || filePath.endsWith('.html')
}

function isNativePageScript(filePath: string) {
  return !filePath.endsWith('.d.ts') && (filePath.endsWith('.ts') || filePath.endsWith('.js'))
}

function isNativePageStyle(filePath: string) {
  return filePath.endsWith('.wxss') || filePath.endsWith('.scss') || filePath.endsWith('.css') || filePath.endsWith('.less')
}

function resolveOutputPath(template: TemplateCase, sourceFile: string, outputExt: string) {
  const relative = path.relative(template.sourceRoot, sourceFile)
  const parsed = path.parse(relative)
  const suffix = outputExt ? `.${outputExt}` : ''
  return path.join(template.workspaceRoot, 'dist', parsed.dir, `${parsed.name}${suffix}`)
}

function pushIfPresent<T>(items: T[], item: T | undefined) {
  if (item) {
    items.push(item)
  }
}

function dedupeScenarios(scenarios: ScenarioCase[]) {
  const used = new Set<string>()
  const result: ScenarioCase[] = []
  for (const scenario of scenarios) {
    const key = `${scenario.id}:${scenario.sourceFile}`
    if (used.has(key)) {
      continue
    }
    used.add(key)
    result.push(scenario)
  }
  return result
}

function selectScenarios(scenarios: ScenarioCase[], limit: number | undefined) {
  if (!limit || scenarios.length <= limit) {
    return scenarios
  }

  const selected: ScenarioCase[] = []
  const remaining = new Set(scenarios)
  for (const group of scenarioGroupPriority) {
    const scenario = scenarios.find(item => remaining.has(item) && item.group === group)
    if (!scenario) {
      continue
    }
    selected.push(scenario)
    remaining.delete(scenario)
    if (selected.length >= limit) {
      return selected
    }
  }

  for (const scenario of scenarios) {
    if (!remaining.has(scenario)) {
      continue
    }
    selected.push(scenario)
    if (selected.length >= limit) {
      break
    }
  }
  return selected
}

function insertBeforeClosingTag(source: string, tagName: string, insertion: string) {
  const closeTag = `</${tagName}>`
  if (!source.includes(closeTag)) {
    return source
  }
  return source.replace(closeTag, `${insertion}${closeTag}`)
}

function removeFileExtension(filePath: string) {
  const ext = path.extname(filePath)
  return ext ? filePath.slice(0, -ext.length) : filePath
}

function createMarker(templateId: string, scenarioId: string, index: number) {
  return `HMR_BENCH_${toIdentifier(templateId)}_${toIdentifier(scenarioId)}_${index + 1}_${Date.now().toString(36)}`
}

async function runCli(args: string[]) {
  await execa(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    env: createDevProcessEnv({
      disableSidecarWatch: true,
    }),
    stdio: 'inherit',
  })
}

function toIdentifier(value: string) {
  return value.replaceAll(/[^a-z0-9]+/gi, '_').replaceAll(/^_+|_+$/g, '').toUpperCase()
}

function toCssIdent(value: string) {
  return value.replaceAll('_', '-').toLowerCase()
}

function normalizePath(value: string | undefined) {
  return (value ?? '').replaceAll('\\', '/')
}

function formatSourceLabel(template: TemplateCase, sourceFile: string) {
  return normalizePath(path.relative(template.sourceRoot, sourceFile))
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
    ? undefined
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageOptional(values: Array<number | undefined>) {
  return average(values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))
}

function maxOptional(values: Array<number | undefined>) {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return present.length ? Math.max(...present) : undefined
}

function parseFilterEnv(raw: string | undefined) {
  return raw
    ?.split(',')
    .map(item => item.trim())
    .filter(Boolean) ?? []
}

function matchesFilter(value: string, filters: string[]) {
  return filters.length === 0 || filters.some(filter => value.includes(filter))
}

function formatFilter(value: string[]) {
  return value.length === 0 ? 'all' : value.join(', ')
}

function formatMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${value.toFixed(2)} ms`
}

function formatMetric(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return value.toFixed(2)
}

function formatMemoryMiB(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${(value / 1024 / 1024).toFixed(1)} MiB`
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
    '# Templates HMR Benchmark',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- filter: ${formatFilter(filter)}`,
    `- templates: ${report.summary.templateCount}`,
    `- scenarios: ${report.summary.measuredScenarioCount}/${report.summary.scenarioCount}`,
    `- iterations: ${report.iterations}`,
    `- budget: ${report.budgetMs} ms`,
    `- timeout: ${report.timeoutMs} ms`,
    `- max profile total: ${formatMs(report.summary.maxMs)}`,
    `- max observed wall: ${formatMs(report.summary.maxWallMs)}`,
    `- over-budget scenarios: ${report.summary.overBudgetCount}/${report.summary.scenarioCount}`,
    `- failed templates: ${report.summary.failedTemplateCount}`,
    `- failed scenarios: ${report.summary.failedScenarioCount}`,
    '',
    '| template | startup | scenarios | max profile | max wall | avg heap | avg rss | failures |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ]

  for (const template of report.templates) {
    const failures = [
      template.error,
      ...template.scenarios.filter(scenario => scenario.error).map(scenario => `${scenario.id}: ${scenario.error}`),
    ].filter(Boolean)
    lines.push([
      template.id,
      formatMetric(template.startupMs),
      String(template.scenarios.length),
      formatMetric(maxOptional(template.scenarios.map(scenario => scenario.maxMs))),
      formatMetric(maxOptional(template.scenarios.map(scenario => scenario.maxWallMs))),
      formatMemoryMiB(averageOptional(template.scenarios.flatMap(scenario => scenario.samples.map(sample => sample.heapUsedBytes)))),
      formatMemoryMiB(averageOptional(template.scenarios.flatMap(scenario => scenario.samples.map(sample => sample.rssBytes)))),
      failures.length ? failures.join('<br>') : '-',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  for (const template of report.templates) {
    lines.push('', `## ${template.id}`, '')
    if (template.error) {
      lines.push(`- project error: ${template.error}`, '')
    }
    lines.push('| group | scenario | avg profile | max profile | avg wall | max wall | avg heap | avg rss | pending | emitted | dirty reason | pending reason | status |')
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |')
    for (const scenario of template.scenarios) {
      const latestSample = scenario.samples[scenario.samples.length - 1]
      lines.push([
        scenario.group,
        scenario.label,
        formatMs(scenario.averageMs),
        formatMs(scenario.maxMs),
        formatMs(scenario.averageWallMs),
        formatMs(scenario.maxWallMs),
        formatMemoryMiB(averageOptional(scenario.samples.map(sample => sample.heapUsedBytes))),
        formatMemoryMiB(averageOptional(scenario.samples.map(sample => sample.rssBytes))),
        latestSample?.pendingCount == null ? '-' : String(latestSample.pendingCount),
        latestSample?.emittedCount == null ? '-' : String(latestSample.emittedCount),
        summarizeReasons(scenario.samples, 'dirtyReasonSummary'),
        summarizeReasons(scenario.samples, 'pendingReasonSummary'),
        scenario.error ? `failed: ${scenario.error}` : scenario.overBudget ? 'over budget' : 'ok',
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
  }

  return `${lines.join('\n')}\n`
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

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function isDirectRun() {
  return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isDirectRun()) {
  await main()
}
