import type { MpPlatform } from '../types'
import type { DoctorRuntimeEvidence, DoctorRuntimeFact, DoctorRuntimeProbeOptions, DoctorRuntimeStage } from './types'
import process from 'node:process'
import { connectOpenedAutomator, queryWechatIdeLogin, resolveProjectAutomatorPort } from 'weapp-ide-cli'
import packageJson from '../../package.json'
import { DoctorProbeTimeout, inspectDoctorCli, inspectDoctorListener, readDoctorHostVersions, readDoctorRoute, withProbeTimeout } from './runtimeProbes'

interface DoctorSession {
  currentPage: () => Promise<{ path: string } | null>
  toolInfo: () => Promise<unknown>
  disconnect: () => void
}

const stages: DoctorRuntimeStage[] = ['cli-executable', 'service-listener', 'login-query', 'login-state', 'project-connection', 'tool-info', 'host-version', 'sdk-version', 'current-page', 'session-release']

/** 连接超时不授予宿主清理权限；迟到连接仅释放其自身 websocket。 */
async function connectDoctorSession(cwd: string, port: number): Promise<DoctorSession> {
  let abandoned = false
  const pending = connectOpenedAutomator({ projectPath: cwd, port, timeout: 3_000 }).then((session) => {
    const ownedSession = session as DoctorSession
    if (abandoned) {
      try {
        ownedSession.disconnect()
      }
      catch {}
    }
    return ownedSession
  })
  try {
    return await withProbeTimeout(pending, 3_000)
  }
  catch (error) {
    abandoned = true
    throw error
  }
}

/** 默认只连接已有项目；原生登录查询单独显式授权，不改变路由或业务状态。 */
export async function probeDoctorRuntime(cwd: string, target: MpPlatform, port?: number, options: DoctorRuntimeProbeOptions = {}): Promise<DoctorRuntimeEvidence> {
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
    reproduction: `wv doctor --runtime --platform ${target} --format json${port !== undefined ? ' --runtime-port <automator-port>' : ''}${options.cliPath ? ' --runtime-cli <selected-cli>' : ''}${options.servicePort !== undefined ? ' --runtime-service-port <service-port>' : ''}${options.login ? ' --runtime-login' : ''}`,
  }
  const evidence: DoctorRuntimeEvidence = { host: 'unknown', route: '', provider, checks: [], facts, bundle, complete: false }
  const record = (stage: DoctorRuntimeStage, status: DoctorRuntimeFact['status'], code: string) => {
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
  let executable = false
  if (options.cliPath) {
    executable = await inspectDoctorCli(options.cliPath)
    record('cli-executable', executable ? 'passed' : 'failed', executable ? 'executable' : 'not-executable')
  }
  if (options.servicePort !== undefined) {
    const result = await inspectDoctorListener(options.servicePort)
    record('service-listener', result === 'listening' ? 'passed' : result === 'not-listening' || result === 'invalid-port' ? 'failed' : 'unknown', result)
  }
  if (options.login) {
    if (!executable || !options.cliPath) {
      record('login-query', 'not-run', 'explicit-executable-required')
      record('login-state', 'unknown', 'query-not-run')
    }
    else {
      const result = await queryWechatIdeLogin(options.cliPath, { timeout: 3_000 })
      record('login-query', result.status === 'success' ? 'passed' : 'unknown', result.status === 'success' ? 'response-received' : result.reason)
      record('login-state', result.status === 'success' ? result.login ? 'passed' : 'failed' : 'unknown', result.status === 'success' ? result.login ? 'logged-in' : 'logged-out' : 'query-incomplete')
    }
  }
  let session: DoctorSession
  try {
    session = await connectDoctorSession(cwd, port ?? resolveProjectAutomatorPort(cwd))
    record('project-connection', 'passed', 'connected')
  }
  catch (error) {
    record('project-connection', 'failed', error instanceof DoctorProbeTimeout ? 'timeout' : 'connection-failed')
    for (const stage of ['tool-info', 'host-version', 'sdk-version', 'current-page'] as const) {
      record(stage, 'not-run', 'connection-unavailable')
    }
    return evidence
  }
  const checks: string[] = []
  const read = async <T>(stage: DoctorRuntimeStage, check: string, operation: () => Promise<T>, accept: (result: T) => boolean) => {
    checks.push(check)
    try {
      const result = await withProbeTimeout(Promise.resolve().then(operation), 5_000)
      const valid = accept(result)
      record(stage, valid ? 'passed' : 'failed', valid ? 'snapshot-read' : 'invalid-response')
    }
    catch (error) {
      record(stage, 'failed', error instanceof DoctorProbeTimeout ? 'timeout' : 'rpc-failed')
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
    try {
      session.disconnect()
      record('session-release', 'passed', 'disconnected')
    }
    catch {
      record('session-release', 'failed', 'disconnect-failed')
    }
  }
  for (const stage of ['host-version', 'sdk-version'] as const) {
    if (facts.find(fact => fact.stage === stage)?.status === 'not-run') {
      record(stage, 'unknown', 'tool-info-unavailable')
    }
  }
  evidence.checks = checks
  evidence.complete = facts.every(fact => fact.status === 'passed' || fact.status === 'not-run')
  return evidence
}
