import type { TutorialRuntimeProvider, TutorialScenarioId, TutorialScenarioRun, TutorialSource } from './config'
import type { TutorialReport, TutorialRunResult } from './report'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {
  assertGuideBuild,
  assertHandbookBuild,
  assertMultiPlatformBuild,
  assertMultiPlatformWebBuild,
} from './assertions'
import {
  createTutorialRuns,
  HANDBOOK_SNIPPET_PATH,
  MINIAPP_PLATFORM_OUTPUTS,
  REPO_ROOT,
  TUTORIAL_SCENARIO_IDS,

} from './config'
import {
  runDevCycle,
  runLoggedCommand,
} from './lifecycle'
import {
  createProjectCommand,
  installCommand,
  packageScriptCommand,
} from './packageManager'
import {

  TutorialRunRecorder,
  writeTutorialReport,
} from './report'
import {
  assertHandbookRuntime,
  assertMultiPlatformRuntime,
  assertMultiPlatformWebRuntime,
} from './runtime'
import {
  linkWorkspacePackages,
  normalizeReportText,
} from './workspace'

interface TutorialCliOptions {
  reportDir: string
  runtimeProvider: TutorialRuntimeProvider
  scenarios: TutorialScenarioId[]
  source: TutorialSource
}

const MINIAPP_PLATFORMS = Object.keys(MINIAPP_PLATFORM_OUTPUTS) as Array<keyof typeof MINIAPP_PLATFORM_OUTPUTS>

function parseList(value: string | undefined) {
  return value?.split(',').map(item => item.trim()).filter(Boolean) ?? []
}

export function parseTutorialCliOptions(args: string[]): TutorialCliOptions {
  const readOption = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  const source = readOption('--source') ?? 'workspace'
  if (source !== 'npm' && source !== 'workspace') {
    throw new Error(`Unsupported tutorial source: ${source}`)
  }
  const runtimeProvider = readOption('--runtime-provider') ?? 'headless'
  if (runtimeProvider !== 'headless' && runtimeProvider !== 'devtools') {
    throw new Error(`Unsupported runtime provider: ${runtimeProvider}`)
  }
  const requestedScenarios = parseList(readOption('--scenario'))
  const scenarios = requestedScenarios.length === 0 || requestedScenarios.includes('all')
    ? [...TUTORIAL_SCENARIO_IDS]
    : requestedScenarios.map((scenario) => {
        if (!TUTORIAL_SCENARIO_IDS.includes(scenario as TutorialScenarioId)) {
          throw new Error(`Unsupported tutorial scenario: ${scenario}`)
        }
        return scenario as TutorialScenarioId
      })

  return {
    reportDir: path.resolve(readOption('--report-dir') ?? path.join(REPO_ROOT, '.tmp/tutorial-e2e-report')),
    runtimeProvider,
    scenarios,
    source,
  }
}

function createProjectName(run: TutorialScenarioRun) {
  return `tutorial-${run.source}-${run.id.replaceAll('/', '-')}`
}

async function copyFailureProject(projectDir: string, reportDir: string, runId: string) {
  const targetDir = path.join(reportDir, 'failures', runId.replaceAll('/', '-'))
  await fs.rm(targetDir, { force: true, recursive: true })
  await fs.cp(projectDir, targetDir, {
    filter: source => !source.split(path.sep).some(segment => [
      '.git',
      '.turbo',
      'dist',
      'node_modules',
    ].includes(segment)),
    recursive: true,
  })
  for (const fileName of ['package.json', 'pnpm-lock.yaml']) {
    const filePath = path.join(targetDir, fileName)
    try {
      const content = await fs.readFile(filePath, 'utf8')
      await fs.writeFile(filePath, normalizeReportText(content, projectDir), 'utf8')
    }
    catch {
      // A failed create/install step may not have produced every manifest.
    }
  }
}

async function forceClassicHmr(projectDir: string) {
  const configPath = path.join(projectDir, 'project.private.config.json')
  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as {
      setting?: Record<string, unknown>
    }
    config.setting = { ...config.setting, compileHotReLoad: false }
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  }
  catch {
    // Templates without a private config already use classic HMR.
  }
}

async function runGuideScenario(
  run: TutorialScenarioRun,
  projectDir: string,
  recorder: TutorialRunRecorder,
  log: (message: string) => void,
  runtimeProvider: TutorialRuntimeProvider,
) {
  if (runtimeProvider === 'headless') {
    await forceClassicHmr(projectDir)
  }
  await recorder.step('dev', async () => {
    await runDevCycle({
      command: packageScriptCommand(run.packageManager, 'dev'),
      cwd: projectDir,
      label: `${run.id} dev`,
      log,
      outputFiles: [path.join(projectDir, 'dist/pages/index/index.js')],
      sourceFile: path.join(projectDir, 'src/pages/index/index.ts'),
    })
  })
  await recorder.step('build', async () => {
    await runLoggedCommand({
      command: packageScriptCommand(run.packageManager, 'build'),
      cwd: projectDir,
      label: `${run.id} build`,
      log,
    })
    await assertGuideBuild(projectDir)
  })
}

async function runHandbookScenario(
  run: TutorialScenarioRun,
  projectDir: string,
  recorder: TutorialRunRecorder,
  log: (message: string) => void,
  runtimeProvider: TutorialRuntimeProvider,
) {
  const pageSource = path.join(projectDir, 'src/pages/index/index.vue')
  if (runtimeProvider === 'headless') {
    await forceClassicHmr(projectDir)
  }
  await recorder.step('apply-tutorial-source', async () => {
    await fs.copyFile(HANDBOOK_SNIPPET_PATH, pageSource)
  })
  await recorder.step('typecheck', async () => {
    await runLoggedCommand({
      command: packageScriptCommand(run.packageManager, 'typecheck'),
      cwd: projectDir,
      label: `${run.id} typecheck`,
      log,
    })
  })
  await recorder.step('dev', async () => {
    await runDevCycle({
      command: packageScriptCommand(run.packageManager, 'dev'),
      cwd: projectDir,
      label: `${run.id} dev`,
      log,
      outputFiles: [path.join(projectDir, 'dist/pages/index/index.wxml')],
      sourceFile: pageSource,
    })
  })
  await recorder.step('build', async () => {
    await runLoggedCommand({
      command: packageScriptCommand(run.packageManager, 'build'),
      cwd: projectDir,
      label: `${run.id} build`,
      log,
    })
    await assertHandbookBuild(projectDir)
  })
  await recorder.step(`runtime-${runtimeProvider}`, async () => {
    await assertHandbookRuntime(projectDir, runtimeProvider)
  })
}

async function runMultiPlatformScenario(
  run: TutorialScenarioRun,
  projectDir: string,
  recorder: TutorialRunRecorder,
  log: (message: string) => void,
  runtimeProvider: TutorialRuntimeProvider,
) {
  const sfc = run.template === 'multi-platform-sfc'
  if (runtimeProvider === 'headless') {
    await forceClassicHmr(projectDir)
  }
  if (sfc) {
    await recorder.step('typecheck', async () => {
      await runLoggedCommand({
        command: packageScriptCommand(run.packageManager, 'typecheck'),
        cwd: projectDir,
        label: `${run.id} typecheck`,
        log,
      })
    })
  }

  for (const platform of MINIAPP_PLATFORMS) {
    await recorder.step(`build-${platform}`, async () => {
      await runLoggedCommand({
        command: packageScriptCommand(run.packageManager, `build:${platform}`),
        cwd: projectDir,
        label: `${run.id} build ${platform}`,
        log,
      })
      await assertMultiPlatformBuild(projectDir, platform)
    })
  }

  await recorder.step('build-web', async () => {
    await runLoggedCommand({
      command: packageScriptCommand(run.packageManager, 'build:web'),
      cwd: projectDir,
      label: `${run.id} build web`,
      log,
    })
    await assertMultiPlatformWebBuild(projectDir)
  })
  await recorder.step(`runtime-${runtimeProvider}`, async () => {
    await assertMultiPlatformRuntime(path.join(projectDir, 'dist/weapp'), runtimeProvider, sfc)
  })
  await recorder.step('runtime-web', async () => {
    await assertMultiPlatformWebRuntime(path.join(projectDir, 'dist/web'), sfc)
  })
}

async function executeTutorialRun(
  run: TutorialScenarioRun,
  tempRoot: string,
  options: TutorialCliOptions,
): Promise<TutorialRunResult> {
  const recorder = new TutorialRunRecorder()
  const scenarioRoot = path.join(tempRoot, run.id.replaceAll('/', '-'))
  const projectName = createProjectName(run)
  const projectDir = path.join(scenarioRoot, projectName)
  const logChunks: string[] = []
  const log = (message: string) => {
    logChunks.push(message)
    process.stdout.write(message)
  }

  let errorText: string | undefined
  try {
    await fs.mkdir(scenarioRoot, { recursive: true })
    await recorder.step('create', async () => {
      await runLoggedCommand({
        command: createProjectCommand(run.source, run.packageManager, projectName, run.template),
        cwd: scenarioRoot,
        label: `${run.id} create`,
        log,
      })
    })
    if (run.source === 'workspace') {
      await recorder.step('link-workspace', async () => {
        const linked = await linkWorkspacePackages(projectDir)
        if (!linked.includes('weapp-vite')) {
          throw new Error('Generated project did not link workspace weapp-vite')
        }
      })
    }
    await recorder.step('install', async () => {
      await runLoggedCommand({
        command: installCommand(run.packageManager),
        cwd: projectDir,
        label: `${run.id} install`,
        log,
      })
    })

    switch (run.scenario) {
      case 'guide-create':
        await runGuideScenario(run, projectDir, recorder, log, options.runtimeProvider)
        break
      case 'handbook-wevu-counter':
        await runHandbookScenario(run, projectDir, recorder, log, options.runtimeProvider)
        break
      case 'multi-platform':
        await runMultiPlatformScenario(run, projectDir, recorder, log, options.runtimeProvider)
        break
    }
  }
  catch (error) {
    errorText = normalizeReportText(error instanceof Error ? error.message : String(error), tempRoot)
    if (await fs.stat(projectDir).then(() => true).catch(() => false)) {
      await copyFailureProject(projectDir, options.reportDir, run.id)
    }
  }
  finally {
    const logsDir = path.join(options.reportDir, 'logs')
    await fs.mkdir(logsDir, { recursive: true })
    await fs.writeFile(
      path.join(logsDir, `${run.source}-${run.id.replaceAll('/', '-')}.log`),
      normalizeReportText(logChunks.join(''), tempRoot),
      'utf8',
    )
  }

  return {
    error: errorText,
    id: run.id,
    packageManager: run.packageManager,
    scenario: run.scenario,
    source: run.source,
    status: errorText ? 'failed' : 'passed',
    steps: recorder.steps,
    template: run.template,
  }
}

async function prepareWorkspace(options: TutorialCliOptions, log: (message: string) => void) {
  if (options.source !== 'workspace' || process.env.TUTORIAL_E2E_SKIP_WORKSPACE_BUILD === '1') {
    return
  }
  await runLoggedCommand({
    command: { args: ['build:pkgs:ci'], command: 'pnpm' },
    cwd: REPO_ROOT,
    label: 'tutorial workspace package build',
    log,
    timeoutMs: 30 * 60 * 1000,
  })
  process.stdout.write('dist sync: rebuilt weapp-vite before downstream validation\n')
}

export async function runTutorialE2E(options: TutorialCliOptions) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tutorial-e2e-'))
  await fs.mkdir(options.reportDir, { recursive: true })
  const setupLog: string[] = []
  try {
    await prepareWorkspace(options, (message) => {
      setupLog.push(message)
      process.stdout.write(message)
    })
    const runs = createTutorialRuns(options.source, options.scenarios)
    const results: TutorialRunResult[] = []
    for (const run of runs) {
      results.push(await executeTutorialRun(run, tempRoot, options))
    }
    const report: TutorialReport = {
      generatedAt: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      results,
      source: options.source,
    }
    await writeTutorialReport(options.reportDir, report)
    return report
  }
  finally {
    if (setupLog.length > 0) {
      await fs.writeFile(
        path.join(options.reportDir, `tutorial-e2e-${options.source}-setup.log`),
        normalizeReportText(setupLog.join(''), tempRoot),
        'utf8',
      )
    }
    await fs.rm(tempRoot, { force: true, recursive: true })
  }
}

async function main() {
  const options = parseTutorialCliOptions(process.argv.slice(2))
  const report = await runTutorialE2E(options)
  const failures = report.results.filter(result => result.status === 'failed')
  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length} tutorial scenario(s) failed:\n`)
    for (const failure of failures) {
      process.stderr.write(`- ${failure.id}: ${failure.error ?? 'Unknown error'}\n`)
    }
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  void main()
}
