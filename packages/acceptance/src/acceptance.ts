import type { ProjectConfig, ProjectInfo, ToolContext } from '@weapp-agent/core/project'
import type { RuntimeConnection, RuntimeConnector } from './runtime.js'
import type { Scenario, ScenarioStepResult } from './scenario.js'
import type { CheckResult } from './verify.js'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  ApprovalRequired,
  configurationSource,
  hash,
  isTrusted,
  loadAcceptanceConfig,
  projectConfigSchema,
  projectFingerprint,
  redactValue,
  safePath,
  stateRoot,
  trustProject,
} from '@weapp-agent/core/project'
import { atomicJson } from './persistence.js'
import { defaultVerification, detectProject } from './project.js'
import { runScenario, runtimeInvoker, scenarioSchema } from './scenario.js'
import { sourceSnapshot } from './snapshot.js'
import { verifyProject } from './verify.js'

export type AcceptanceStatus = 'running' | 'passed' | 'failed' | 'unverified' | 'action_required' | 'cancelled' | 'timed_out' | 'interrupted'
export interface AcceptanceReport {
  version: 2
  jobId: string
  root: string
  ownerPid: number
  status: AcceptanceStatus
  passed: boolean
  startedAt: string
  finishedAt?: string
  project: ProjectInfo
  requiredChecks: ProjectConfig['acceptance']['requiredChecks']
  checks: CheckResult[]
  steps: ScenarioStepResult[]
  artifacts: Array<{ name: string, mediaType: string }>
  runtime: 'unverified' | 'wechat-devtools'
  snapshot: { before?: string, after?: string, current?: string, stale: boolean }
  reason?: string
  warnings: string[]
}

export async function resolveProjectConfig(root: string, file?: string): Promise<ProjectConfig> {
  return await loadAcceptanceConfig(root, file) ?? projectConfigSchema.parse({ verification: defaultVerification(await detectProject(root)) })
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/** Locks survive server instances. Dead owners are inspected, never replayed. */
async function lockProject(directory: string, jobId: string): Promise<() => Promise<void>> {
  const lock = path.join(directory, 'lock')
  try {
    await mkdir(lock)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
    const recovery = path.join(directory, 'lock-recovery')
    try {
      await mkdir(recovery)
    }
    catch {
      throw new ApprovalRequired('Project lock recovery is busy; retry after inspecting the previous task.')
    }
    try {
      const owner = await readFile(path.join(lock, 'owner.json'), 'utf8').then(JSON.parse).catch(() => undefined)
      if (!owner || alive(owner.pid)) {
        throw new ApprovalRequired('Another acceptance task owns this project. Query/cancel that task before starting a new one.')
      }
      await rm(lock, { recursive: true, force: true })
    }
    finally {
      await rm(recovery, { recursive: true, force: true })
    }
    return lockProject(directory, jobId)
  }
  await atomicJson(path.join(lock, 'owner.json'), { pid: process.pid, jobId })
  return async () => {
    const owner = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8'))
    if (owner.jobId === jobId) {
      await rm(lock, { recursive: true, force: true })
    }
  }
}

export interface AcceptanceOptions {
  /** Explicit CLI startup authorization only; never accepted as an MCP tool argument. */
  trust?: boolean
  connect?: RuntimeConnector
  configFile?: string
}

export class AcceptanceService {
  private jobs = new Map<string, { controller: AbortController, done: Promise<void>, report: AcceptanceReport, persistenceFailed: boolean }>()
  private starting = new Set<Promise<AcceptanceReport>>()
  private closed = false
  private constructor(readonly root: string, private directory: string, private options: AcceptanceOptions) {}

  static async create(root: string, options: AcceptanceOptions = {}): Promise<AcceptanceService> {
    root = await realpath(root)
    const directory = path.join(stateRoot(), 'acceptance', hash(root))
    await mkdir(directory, { recursive: true, mode: 0o700 })
    if (options.trust) {
      const config = await resolveProjectConfig(root, options.configFile)
      await trustProject(root, await projectFingerprint(root, config))
    }
    return new AcceptanceService(root, directory, options)
  }

  private jobDirectory(jobId: string): string {
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(jobId)) {
      throw new Error('Invalid acceptance job ID')
    }
    return path.join(this.directory, jobId)
  }

  async inspect() {
    const project = await detectProject(this.root)
    const config = await resolveProjectConfig(this.root, this.options.configFile)
    const localMcp = Boolean(this.options.connect)
    const trusted = await isTrusted(this.root, await projectFingerprint(this.root, config))
    const scenarioProblems: string[] = []
    for (const file of config.acceptance.scenarios) {
      try {
        scenarioSchema.parse(JSON.parse(await readFile(await safePath(this.root, file), 'utf8')))
      }
      catch (error) {
        scenarioProblems.push(`${file}: ${String(error)}`)
      }
    }
    const missingChecks = config.acceptance.requiredChecks.filter(kind => kind !== 'devtools' && !config.verification.some(c => c.kind === kind))
    let hasTestAppId = false
    try {
      const app = JSON.parse(await readFile(await safePath(this.root, 'project.config.json'), 'utf8'))
      hasTestAppId = Boolean(app.appid && app.appid !== 'touristappid')
    }
    catch {
      // Inspection reports missing prerequisites without launching the runtime.
    }
    return {
      version: 2,
      project,
      supported: Boolean(project.weappViteVersion && project.kind !== 'unknown'),
      modelRequired: false,
      configurationSource: configurationSource(config) ?? 'auto',
      trusted,
      localMcp,
      requiredChecks: config.acceptance.requiredChecks,
      configuredChecks: config.verification.map(c => c.kind),
      scenarios: config.acceptance.scenarios,
      scenarioProblems,
      hasTestAppId,
      prerequisites: [
        ...missingChecks.map(kind => `Configure a ${kind} verification command in the selected acceptance configuration.`),
        ...scenarioProblems.map(problem => `Repair scenario: ${problem}`),
        ...(!trusted ? ['Review project scripts/configuration, then explicitly run wv accept --trust.'] : []),
        ...(!localMcp ? ['Install the project dependencies to provide the local weapp-vite MCP.'] : []),
        ...(!config.acceptance.scenarios.length ? ['Add acceptance.scenarios to the selected acceptance configuration for runtime assertions.'] : []),
        ...(!hasTestAppId ? ['Configure a real test AppID in project.config.json before runtime checks.'] : []),
        'Runtime checks require logged-in WeChat DevTools, its service port enabled, and a real test AppID. Connection has not been probed.',
      ],
    }
  }

  start(): Promise<AcceptanceReport> {
    const pending = this.startTask()
    this.starting.add(pending)
    void pending.then(() => this.starting.delete(pending), () => this.starting.delete(pending))
    return pending
  }

  private async startTask(): Promise<AcceptanceReport> {
    if (this.closed) {
      throw new Error('Acceptance service is closed')
    }
    const project = await detectProject(this.root)
    const config = await resolveProjectConfig(this.root, this.options.configFile)
    const report: AcceptanceReport = {
      version: 2,
      jobId: randomUUID(),
      root: this.root,
      ownerPid: process.pid,
      status: 'running',
      passed: false,
      startedAt: new Date().toISOString(),
      project,
      requiredChecks: config.acceptance.requiredChecks,
      checks: [],
      steps: [],
      artifacts: [],
      runtime: 'unverified',
      snapshot: { stale: false },
      warnings: [...project.warnings],
    }
    const directory = this.jobDirectory(report.jobId)
    await mkdir(directory, { mode: 0o700 })
    const persist = () => atomicJson(path.join(directory, 'report.json'), report)
    let release: (() => Promise<void>) | undefined
    try {
      if (!project.weappViteVersion || project.kind === 'unknown') {
        throw new ApprovalRequired('Acceptance supports weapp-vite native and Wevu projects on WeChat only.')
      }
      const fingerprint = await projectFingerprint(this.root, config)
      if (!await isTrusted(this.root, fingerprint)) {
        throw new ApprovalRequired('Review project scripts/configuration, then explicitly run wv accept --trust.')
      }
      release = await lockProject(this.directory, report.jobId)
      if (this.closed) {
        throw new Error('Acceptance service is shutting down; no checks were started')
      }
      const controller = new AbortController()
      await persist()
      const unlock = release
      const job = { controller, done: Promise.resolve(), report, persistenceFailed: false }
      job.done = this.execute(report, config, fingerprint, controller, persist)
        .catch((error) => {
          report.status = 'failed'
          report.passed = false
          report.reason = `Could not persist acceptance result: ${String(error)}`
        })
        .finally(async () => {
          try {
            await unlock()
          }
          catch (error) {
            report.warnings.push(`Project lock cleanup failed: ${String(error)}`)
            report.status = 'failed'
            report.passed = false
            report.reason = 'Project ownership could not be released; inspect the cleanup warning before retrying.'
          }
          // 终态只能在资源释放后发布，跨服务轮询者据此才能安全启动下一任务。
          await persist().catch((error) => {
            job.persistenceFailed = true
            report.status = 'failed'
            report.passed = false
            report.reason = `Could not persist acceptance result: ${String(error)}`
          })
          if (!job.persistenceFailed) {
            this.jobs.delete(report.jobId)
          }
        })
      this.jobs.set(report.jobId, job)
    }
    catch (error) {
      await release?.()
      report.status = error instanceof ApprovalRequired ? 'action_required' : 'failed'
      report.reason = error instanceof Error ? error.message : String(error)
      report.finishedAt = new Date().toISOString()
      await persist()
    }
    return redactValue(structuredClone(report))
  }

  private async execute(
    report: AcceptanceReport,
    config: ProjectConfig,
    fingerprint: string,
    controller: AbortController,
    persist: () => Promise<void>,
  ): Promise<void> {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(config.acceptance.timeoutMs)])
    const context: ToolContext = { root: this.root, trusted: true, signal, approve: async () => false }
    let connection: RuntimeConnection | undefined
    const directory = this.jobDirectory(report.jobId)
    const checkFreshness = async () => {
      if (report.snapshot.before) {
        report.snapshot.stale ||= report.snapshot.before !== await sourceSnapshot(report.project)
      }
    }
    const recordCheck = async (check: CheckResult) => {
      report.checks.push(check)
      await checkFreshness()
      await persist()
    }
    try {
      report.snapshot.before = await sourceSnapshot(report.project)
      const scenarios: Scenario[] = []
      for (const file of config.acceptance.scenarios) {
        scenarios.push(scenarioSchema.parse(JSON.parse(await readFile(await safePath(this.root, file), 'utf8'))))
      }
      await persist()
      // The legacy command runner is shared. Runtime proof comes from scenarios, not an arbitrary script labelled devtools.
      if (new Set(scenarios.map(s => s.name)).size !== scenarios.length) {
        throw new Error('Scenario names must be unique within an acceptance task')
      }
      // Acquire the runtime scope before building so external page operations cannot race the task.
      if (scenarios.length && this.options.connect) {
        connection = await this.options.connect({ name: 'weapp', transport: 'stdio', command: '', args: [] }, context, { config, fingerprint, builtin: true })
      }
      await verifyProject(config, context, fingerprint, recordCheck, ['devtools'])
      if (scenarios.length && report.checks.some(c => c.kind === 'build' && c.status === 'passed')
        && !report.checks.some(c => c.status === 'failed')) {
        if (await projectFingerprint(this.root, config) !== fingerprint) {
          throw new ApprovalRequired('Project configuration changed during verification. Review it before another run.')
        }
        const connect = this.options.connect
        if (!connect) {
          throw new ApprovalRequired('DevTools runtime adapter is unavailable. Use wv accept or the weapp-vite MCP.')
        }
        const app = JSON.parse(await readFile(await safePath(this.root, 'project.config.json'), 'utf8'))
        if (!app.appid || app.appid === 'touristappid') {
          throw new ApprovalRequired('Configure a real test AppID in project.config.json and log into WeChat DevTools.')
        }
        connection ??= await connect({ name: 'weapp', transport: 'stdio', command: '', args: [] }, context, { config, fingerprint, builtin: true })
        const invoke = runtimeInvoker(connection, context)
        const connected = await invoke('weapp_devtools_connect', { projectPath: this.root, preserveProjectRoot: true, timeout: 60_000 })
        const runtimeRoot = connected.resolvedProjectPath ?? connected.projectPath
        if (typeof runtimeRoot !== 'string' || await realpath(runtimeRoot) !== this.root) {
          throw new Error('DevTools connected to a different or unidentified project; evidence is unverified.')
        }
        if (connected.systemInfo?.platform !== 'devtools') {
          throw new Error('Runtime did not identify itself as WeChat DevTools; evidence is unverified.')
        }
        report.runtime = 'wechat-devtools'
        await persist()
        let screenshot = 0
        const capture = async () => {
          const name = `screenshot-${++screenshot}.png`
          const outputPath = `artifacts/weapp-agent/${report.jobId}/${name}`
          const target = await safePath(this.root, outputPath)
          await mkdir(path.dirname(target), { recursive: true })
          await invoke('weapp_devtools_capture', { projectPath: this.root, preserveProjectRoot: true, outputPath })
          const bytes = await readFile(await safePath(this.root, outputPath))
          if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
            throw new Error('Runtime screenshot is not a supported PNG artifact (maximum 10 MB)')
          }
          await writeFile(path.join(directory, name), bytes, { mode: 0o600 })
          report.artifacts.push({ name, mediaType: 'image/png' })
          await persist()
          return name
        }
        try {
          for (const scenario of scenarios) {
            await runScenario(scenario, invoke, context, async (step) => {
              await checkFreshness()
              const previous = report.steps.findIndex(s => s.scenario === step.scenario && s.index === step.index)
              if (previous === -1) {
                report.steps.push(structuredClone(step))
              }
              else {
                report.steps[previous] = structuredClone(step)
              }
              await persist()
            }, capture)
            await capture()
          }
          await recordCheck({ kind: 'devtools', status: 'passed', output: `${scenarios.length} scenario(s) passed in WeChat DevTools. No physical-device or visual-regression claim.` })
        }
        catch (error) {
          await recordCheck({ kind: 'devtools', status: 'failed', output: String(error) })
          if (!signal.aborted) {
            await capture().catch(e => report.warnings.push(`Failure screenshot unavailable: ${String(e)}`))
          }
          throw error
        }
        finally {
          if (!signal.aborted) {
            try {
              const logs = await invoke('weapp_devtools_console', { projectPath: this.root })
              await atomicJson(path.join(directory, 'console.json'), logs)
              report.artifacts.push({ name: 'console.json', mediaType: 'application/json' })
            }
            catch (error) {
              report.warnings.push(`Console evidence unavailable: ${String(error)}`)
              report.checks.push({ kind: 'devtools', status: 'unverified', output: 'Console evidence could not be collected.' })
            }
          }
        }
      }
      for (const kind of ['typecheck', 'build', 'test', 'devtools'] as const) {
        if (!report.checks.some(c => c.kind === kind)) {
          report.checks.push({ kind, status: 'unverified', output: kind === 'devtools' ? 'Runtime scenarios were not executed. Configure scenarios and pass the build first.' : 'No verification command configured.' })
        }
      }
      report.status = report.checks.some(c => c.timedOut)
        ? 'timed_out'
        : report.checks.some(c => c.status === 'failed')
          ? 'failed'
          : report.requiredChecks.every(kind => report.checks.some(c => c.kind === kind && c.status === 'passed') && !report.checks.some(c => c.kind === kind && c.status !== 'passed'))
            ? 'passed'
            : 'unverified'
    }
    catch (error) {
      report.status = signal.aborted
        ? (controller.signal.aborted ? 'cancelled' : 'timed_out')
        : error instanceof ApprovalRequired ? 'action_required' : 'failed'
      report.reason = error instanceof Error ? error.message : String(error)
    }
    finally {
      if (connection) {
        await connection.close().catch(error => report.warnings.push(`MCP cleanup: ${String(error)}`))
      }
      try {
        report.snapshot.after = await sourceSnapshot(report.project)
        report.snapshot.stale ||= Boolean(report.snapshot.before && report.snapshot.before !== report.snapshot.after)
      }
      catch (error) {
        report.snapshot.stale = true
        report.warnings.push(`Cannot validate source freshness: ${String(error)}`)
      }
      if (report.snapshot.stale && report.status === 'passed') {
        report.status = 'unverified'
        report.reason = 'Source changed during acceptance. Run acceptance again against the current code.'
      }
      report.finishedAt = new Date().toISOString()
      for (const kind of ['typecheck', 'build', 'test', 'devtools'] as const) {
        if (!report.checks.some(c => c.kind === kind)) {
          report.checks.push({ kind, status: 'unverified', output: 'Check did not complete; inspect task status and reason.' })
        }
      }
      report.passed = report.status === 'passed' && !report.snapshot.stale
    }
  }

  async report(jobId: string): Promise<AcceptanceReport> {
    const file = path.join(this.jobDirectory(jobId), 'report.json')
    const live = this.jobs.get(jobId)
    const report: AcceptanceReport = live?.persistenceFailed
      ? structuredClone(live.report)
      : JSON.parse(await readFile(file, 'utf8'))
    if (report.root !== this.root || report.version !== 2) {
      throw new Error('Report does not belong to this project or has an unsupported version')
    }
    if (report.status === 'running' && !this.jobs.has(jobId) && !alive(report.ownerPid)) {
      report.status = 'interrupted'
      report.reason = 'Owner exited during acceptance. Inspect partial steps and current runtime state before starting a new task. No steps were replayed.'
      report.passed = false
    }
    if (report.snapshot.before) {
      try {
        report.snapshot.current = await sourceSnapshot(report.project)
        report.snapshot.stale ||= report.snapshot.current !== report.snapshot.before
      }
      catch {
        report.snapshot.stale = true
      }
      if (report.snapshot.stale) {
        report.passed = false
        if (report.status === 'passed') {
          report.status = 'unverified'
          report.reason = 'Evidence is stale for the current source. Start a new acceptance task.'
        }
      }
    }
    return redactValue(report)
  }

  async wait(jobId: string): Promise<AcceptanceReport> {
    await this.jobs.get(jobId)?.done
    return this.report(jobId)
  }

  async cancel(jobId: string): Promise<AcceptanceReport> {
    const job = this.jobs.get(jobId)
    if (job) {
      job.controller.abort()
      return this.wait(jobId)
    }
    const report = await this.report(jobId)
    if (report.status === 'running') {
      throw new Error('Cancel this task through the MCP server/CLI process that started it.')
    }
    return report
  }

  async artifact(jobId: string, name: string): Promise<{ mediaType: string, data: string }> {
    const report = await this.report(jobId)
    const artifact = report.artifacts.find(a => a.name === name)
    if (!artifact || !/^(?:screenshot-\d+\.png|console\.json)$/.test(name)) {
      throw new Error('Unknown acceptance artifact')
    }
    const bytes = await readFile(path.join(this.jobDirectory(jobId), name))
    if (bytes.length > 10 * 1024 * 1024) {
      throw new Error('Artifact exceeds the 10 MB response limit')
    }
    return { mediaType: artifact.mediaType, data: artifact.mediaType === 'image/png' ? bytes.toString('base64') : bytes.toString('utf8') }
  }

  async close(): Promise<void> {
    this.closed = true
    await Promise.allSettled([...this.starting])
    for (const job of this.jobs.values()) {
      job.controller.abort()
    }
    await Promise.allSettled([...this.jobs.values()].map(job => job.done))
  }
}
