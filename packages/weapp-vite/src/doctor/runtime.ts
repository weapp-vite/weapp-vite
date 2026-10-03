import type { MpPlatform } from '../types'
import type { DoctorRuntimeEvidence, DoctorRuntimeFact, DoctorRuntimeProbeOptions, DoctorRuntimeStage } from './types'
import process from 'node:process'
import { classifyOperationError, OperationLifecycle } from '@weapp-vite/miniprogram-automator'
import { connectOpenedAutomator, queryWechatIdeLogin, resolveProjectAutomatorPort } from 'weapp-ide-cli'
import packageJson from '../../package.json'
import { inspectDoctorCli, inspectDoctorListener, readDoctorHostVersions, readDoctorRoute } from './runtimeProbes'

interface DoctorSession {
  currentPage: () => Promise<{ path: string } | null>
  toolInfo: () => Promise<unknown>
  disconnect: () => void
}

const stages: DoctorRuntimeStage[] = ['cli-executable', 'service-listener', 'login-query', 'login-state', 'project-connection', 'tool-info', 'host-version', 'sdk-version', 'current-page', 'session-release']

/** 每个探针保留局部上限，并受同一个总 deadline 约束。 */
async function probeStep<T>(scope: OperationLifecycle, stage: DoctorRuntimeStage, cap: number, run: (signal: AbortSignal, timeout: number) => Promise<T>, disposeLate?: (value: T) => void) {
  const phase = new OperationLifecycle(scope.remainingMs(cap), stage, scope.signal)
  return await scope.step(() => phase.run(() => phase.step(() => run(phase.signal, phase.remainingMs()), { stage, disposeLate })), { stage })
}

/** 默认只连接已有项目；原生登录查询单独显式授权，不改变路由或业务状态。 */
export async function probeDoctorRuntime(cwd: string, target: MpPlatform, port?: number, options: DoctorRuntimeProbeOptions = {}): Promise<DoctorRuntimeEvidence> {
  const scope = new OperationLifecycle(options.timeout ?? 10_000, 'Doctor runtime', options.signal)
  let finalized = false
  const facts: DoctorRuntimeFact[] = stages.map(stage => ({ stage, status: 'not-run', code: 'not-requested' }))
  const events: DoctorRuntimeFact[] = []
  const provider = target === 'weapp' ? 'devtools' : 'unsupported'
  const bundle = {
    frameworkVersion: packageJson.version,
    nodeVersion: process.version,
    versions: {} as { ide?: string, sdk?: string },
    configuration: { target, provider, explicitCli: !!options.cliPath, explicitAutomatorPort: port !== undefined, explicitServicePort: options.servicePort !== undefined, loginRequested: options.login === true },
    lastSuccessfulStage: undefined as DoctorRuntimeStage | undefined,
    events,
    operation: scope.diagnostics,
    reproduction: `wv doctor --runtime --platform ${target} --format json${port !== undefined ? ' --runtime-port <automator-port>' : ''}${options.cliPath ? ' --runtime-cli <selected-cli>' : ''}${options.servicePort !== undefined ? ' --runtime-service-port <service-port>' : ''}${options.login ? ' --runtime-login' : ''}`,
  }
  const evidence: DoctorRuntimeEvidence = { host: 'unknown', route: '', provider, checks: [], facts, bundle, complete: false }
  const record = (stage: DoctorRuntimeStage, status: DoctorRuntimeFact['status'], code: string) => {
    if (finalized) {
      return
    }
    const fact = { stage, status, code }
    facts[stages.indexOf(stage)] = fact
    events.push(fact)
    if (status === 'passed' && stage !== 'session-release') {
      bundle.lastSuccessfulStage = stage
    }
  }
  if (target !== 'weapp') {
    record('project-connection', 'unknown', 'unsupported-host')
    return evidence
  }
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    record('project-connection', 'failed', 'invalid-port')
    return evidence
  }
  try {
    return await scope.run(async () => {
      scope.attempt()
      let executable = false
      if (options.cliPath) {
        executable = await probeStep(scope, 'cli-executable', 1_000, () => inspectDoctorCli(options.cliPath!))
        record('cli-executable', executable ? 'passed' : 'failed', executable ? 'executable' : 'not-executable')
      }
      if (options.servicePort !== undefined) {
        const result = await probeStep(scope, 'service-listener', 1_000, signal => inspectDoctorListener(options.servicePort!, signal))
        record('service-listener', result === 'listening' ? 'passed' : result === 'not-listening' || result === 'invalid-port' ? 'failed' : 'unknown', result)
      }
      if (options.login) {
        if (!executable || !options.cliPath) {
          record('login-query', 'not-run', 'explicit-executable-required')
          record('login-state', 'unknown', 'query-not-run')
        }
        else {
          const result = await probeStep(scope, 'login-query', 3_000, (signal, timeout) => queryWechatIdeLogin(options.cliPath!, { timeout, signal }))
          record('login-query', result.status === 'success' ? 'passed' : 'unknown', result.status === 'success' ? 'response-received' : result.reason)
          record('login-state', result.status === 'success' ? result.login ? 'passed' : 'failed' : 'unknown', result.status === 'success' ? result.login ? 'logged-in' : 'logged-out' : 'query-incomplete')
        }
      }
      let session: DoctorSession
      try {
        session = await probeStep(scope, 'project-connection', 3_000, async (signal, timeout) => await connectOpenedAutomator({ projectPath: cwd, port: port ?? resolveProjectAutomatorPort(cwd), timeout, signal }) as DoctorSession, session => session.disconnect())
        record('project-connection', 'passed', 'connected')
      }
      catch (error) {
        record('project-connection', 'failed', classifyOperationError(error) === 'timeout' ? 'timeout' : 'connection-failed')
        for (const stage of ['tool-info', 'host-version', 'sdk-version', 'current-page'] as const) {
          record(stage, 'not-run', 'connection-unavailable')
        }
        return evidence
      }
      let released = false
      const release = () => {
        if (released) {
          return
        }
        released = true
        try {
          session.disconnect()
          record('session-release', 'passed', 'disconnected')
        }
        catch {
          record('session-release', 'failed', 'disconnect-failed')
        }
      }
      scope.own(release, 'doctor-websocket')
      const checks: string[] = []
      const read = async <T>(stage: DoctorRuntimeStage, check: string, operation: () => Promise<T>, accept: (result: T) => boolean) => {
        checks.push(check)
        try {
          const result = await probeStep(scope, stage, 5_000, operation)
          const valid = accept(result)
          record(stage, valid ? 'passed' : 'failed', valid ? 'snapshot-read' : 'invalid-response')
        }
        catch (error) {
          record(stage, 'failed', classifyOperationError(error) === 'timeout' ? 'timeout' : 'rpc-failed')
        }
      }
      try {
        await Promise.all([
          read('tool-info', 'Tool.getInfo', () => session.toolInfo(), (info) => {
            if (!info || typeof info !== 'object') {
              return false
            }
            evidence.host = 'wechat-devtools'
            bundle.versions = readDoctorHostVersions(info)
            record('host-version', bundle.versions.ide ? 'passed' : 'unknown', bundle.versions.ide ? 'version-read' : 'version-unavailable')
            record('sdk-version', bundle.versions.sdk ? 'passed' : 'unknown', bundle.versions.sdk ? 'version-read' : 'version-unavailable')
            return true
          }),
          read('current-page', 'App.getCurrentPage', () => session.currentPage(), (page) => {
            const route = readDoctorRoute(page?.path)
            if (!route) {
              return false
            }
            evidence.route = route
            return true
          }),
        ])
      }
      finally {
        release()
      }
      for (const stage of ['host-version', 'sdk-version'] as const) {
        if (facts.find(fact => fact.stage === stage)?.status === 'not-run') {
          record(stage, 'unknown', 'tool-info-unavailable')
        }
      }
      evidence.checks = checks
      evidence.complete = facts.every(fact => fact.status === 'passed' || fact.status === 'not-run')
      return evidence
    })
  }
  catch (error) {
    const stage = stages.includes(scope.diagnostics.stage as DoctorRuntimeStage) ? scope.diagnostics.stage as DoctorRuntimeStage : 'project-connection'
    record(stage, 'failed', classifyOperationError(error))
    evidence.complete = false
    return evidence
  }
  finally {
    bundle.operation = scope.diagnostics
    finalized = true
  }
}
