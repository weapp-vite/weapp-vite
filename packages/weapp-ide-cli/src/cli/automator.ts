import type { AutomatorInstallationOptions } from './automator/context'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { OperationLifecycle } from '@weapp-vite/miniprogram-automator/operation'
import { readCustomConfig } from '../config/custom'
import { assertWechatDevtoolsHost, assertWechatDevtoolsPort } from '../devtoolsTarget'
import { resolveAutomatorSessionOptions } from './automator/context'
import { isRetryableAutomatorLaunchError } from './automator/errors'
import { persistAutomatorSession, readPersistedAutomatorSession } from './automator/sessionStore'
import { resolveAutomatorProjectPath } from './automatorProject'
import { bootstrapWechatDevtoolsSettings } from './wechatDevtoolsSettings'

export * from './automator/errors'

export interface AutomatorOptions extends AutomatorInstallationOptions {
  projectPath: string
  timeout?: number
  signal?: AbortSignal
  cliPath?: string
  port?: number
  sessionId?: string
  trustProject?: boolean
  preferOpenedSession?: boolean
  preserveProjectRoot?: boolean
  persistAsDefaultSession?: boolean
}

const PROJECT_AUTOMATOR_PORT_BASE = 9620
const PROJECT_AUTOMATOR_PORT_RANGE = 2000

/**
 * @description 为项目路径派生稳定的 DevTools automator 端口，避免多个 dev:open 项目抢占默认端口。
 */
export function resolveProjectAutomatorPort(projectPath: string) {
  const digest = createHash('sha1').update(path.resolve(projectPath)).digest()
  const offset = digest.readUInt32BE(0) % PROJECT_AUTOMATOR_PORT_RANGE
  return PROJECT_AUTOMATOR_PORT_BASE + offset
}

async function launchSelectedAutomator(options: AutomatorOptions) {
  const { port, projectPath, sessionId, timeout = 30_000 } = options
  const lifecycle = new OperationLifecycle(timeout, 'IDE launch', options.signal)
  return await lifecycle.run(async (scope) => {
    const { Launcher } = await scope.step(() => import('@weapp-vite/miniprogram-automator'), { stage: 'load-automator' })
    const resolvedOptions = await scope.step(() => resolveAutomatorSessionOptions(options), { stage: 'resolve-cli' })
    const { target, cliPath: resolvedCliPath, installationId, runtimeProvider } = resolvedOptions
    if (runtimeProvider === 'headless') {
      return await scope.step(() => new Launcher().launch({ projectPath, runtimeProvider, timeout: scope.remainingMs(), signal: scope.signal }), { stage: 'launch', disposeLate: program => program.disconnect() })
    }
    await scope.step(() => assertWechatDevtoolsHost(target!, { signal: scope.signal, timeout: scope.remainingMs() }), { stage: 'host-identity' })
    const config = await scope.step(() => readCustomConfig(), { stage: 'configuration' })
    const resolvedTrustProject = options.trustProject ?? config.autoTrustProject ?? false
    const launcher = new Launcher()
    let lastError: unknown = null
    let bootstrapResult: Awaited<ReturnType<typeof bootstrapWechatDevtoolsSettings>> | undefined
    const resolvedProject = options.preserveProjectRoot
      ? {
          projectPath: path.resolve(projectPath),
          sourceProjectPath: path.resolve(projectPath),
        }
      : await scope.step(() => resolveAutomatorProjectPath(projectPath), { stage: 'project' })

    if (config.autoBootstrapDevtools !== false) {
      bootstrapResult = await scope.step(() => bootstrapWechatDevtoolsSettings({
        target,
        projectPath: resolvedProject.projectPath,
        trustProject: resolvedTrustProject,
      }), { stage: 'settings' })
    }

    if (bootstrapResult?.servicePortEnabled === false) {
      throw new Error('Detected WeChat DevTools service port is disabled in current settings. Please enable it manually; existing user settings were not modified.')
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      scope.attempt()
      try {
        const miniProgram = await scope.step(() => launcher.launch({
          cliPath: resolvedCliPath,
          ...(port ? { port } : {}),
          projectPath: resolvedProject.projectPath,
          timeout: scope.remainingMs(),
          signal: scope.signal,
          trustProject: resolvedTrustProject,
        }), { stage: 'launch', disposeLate: program => program.disconnect() })
        scope.own(() => miniProgram.disconnect(), 'automator-session')
        const sessionMetadata = Reflect.get(miniProgram as object, '__WEAPP_VITE_SESSION_METADATA') as { port?: number, wsEndpoint?: string } | undefined
        if (typeof sessionMetadata?.wsEndpoint === 'string' && sessionMetadata.wsEndpoint) {
          const wsEndpoint = sessionMetadata.wsEndpoint
          await scope.step(() => assertWechatDevtoolsPort(target!, Number(new URL(wsEndpoint).port), { signal: scope.signal, timeout: scope.remainingMs() }), { stage: 'port-identity' })
          await scope.step(() => persistAutomatorSession({
            installationId: installationId!,
            signal: scope.signal,
            ...(port ? { port: sessionMetadata.port ?? port } : {}),
            projectPath,
            sessionId,
            wsEndpoint,
          }), { stage: 'session-persist' })
          if (options.persistAsDefaultSession && (port || sessionId)) {
            await scope.step(() => persistAutomatorSession({
              installationId: installationId!,
              signal: scope.signal,
              projectPath,
              wsEndpoint,
            }), { stage: 'session-persist' })
          }
        }
        return miniProgram
      }
      catch (error) {
        lastError = error
        scope.recordFailure(error)
        scope.throwIfAborted()
        if (
          !isRetryableAutomatorLaunchError(error)
          || attempt === 1
        ) {
          throw error
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  })
}

/**
 * @description 基于当前配置解析 CLI 路径，并通过现代化 automator 入口启动会话。
 */
export async function launchAutomator(options: AutomatorOptions) {
  options.signal?.throwIfAborted()
  const provider = options.runtimeProvider ?? process.env.WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER ?? process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER
  return provider === 'headless'
    ? await launchSelectedAutomator(options)
    : await withMachineE2ELease(() => launchSelectedAutomator(options))
}

/**
 * @description 登记由外部 automator bridge 创建的会话，供 CLI 子进程安全复用。
 */
export async function persistOpenedAutomatorSession(options: AutomatorOptions & { wsEndpoint: string }) {
  const resolved = await resolveAutomatorSessionOptions(options)
  if (resolved.runtimeProvider === 'headless' || !resolved.target) {
    throw new Error('DEVTOOLS_SESSION_PROVIDER_INVALID: external automator sessions require the WeChat DevTools provider.')
  }
  const endpoint = new URL(options.wsEndpoint)
  if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port) {
    throw new Error('DEVTOOLS_SESSION_ENDPOINT_INVALID: automator session endpoint must be a loopback websocket.')
  }
  const endpointPort = Number(endpoint.port)
  const port = options.port ?? endpointPort
  if (port !== endpointPort) {
    throw new Error(`DEVTOOLS_SESSION_PORT_MISMATCH: endpoint=${endpointPort} option=${port}`)
  }
  await assertWechatDevtoolsPort(resolved.target, endpointPort, {
    signal: options.signal,
    timeout: options.timeout ?? 30_000,
  })
  await persistAutomatorSession({
    installationId: resolved.installationId,
    projectPath: options.projectPath,
    port,
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    signal: options.signal,
    wsEndpoint: options.wsEndpoint,
  })
  if (!options.port && !options.sessionId) {
    await persistAutomatorSession({
      installationId: resolved.installationId,
      projectPath: options.projectPath,
      signal: options.signal,
      wsEndpoint: options.wsEndpoint,
    })
  }
}

/**
 * @description 只读连接当前项目已打开的自动化会话；失败不证明缓存过期，也不删除其他操作持有的会话记录。
 */
export async function connectOpenedAutomator(options: AutomatorOptions) {
  const { port, projectPath, sessionId } = options
  const lifecycle = new OperationLifecycle(options.timeout ?? 30_000, 'IDE connect', options.signal)
  return await lifecycle.run(async (scope) => {
    const { Launcher } = await scope.step(() => import('@weapp-vite/miniprogram-automator'), { stage: 'load-automator' })
    scope.attempt()
    const launcher = new Launcher()
    const resolved = await scope.step(() => resolveAutomatorSessionOptions(options), { stage: 'resolve-cli' })
    const persistedSession = await scope.step(() => readPersistedAutomatorSession({ projectPath, sessionId, port, installationId: resolved.installationId! }), { stage: 'session-lookup' })
    if (!persistedSession) {
      throw Object.assign(new Error('DEVTOOLS_SESSION_IDENTITY_UNVERIFIED: no matching installation-bound session; launch the selected installation before connecting.'), { code: 'DEVTOOLS_SESSION_IDENTITY_UNVERIFIED' })
    }
    const wsEndpoint = persistedSession.wsEndpoint
    await scope.step(() => assertWechatDevtoolsPort(resolved.target!, Number(new URL(wsEndpoint).port), { signal: scope.signal, timeout: scope.remainingMs() }), { stage: 'port-identity' })
    return await scope.step(() => launcher.connect({ timeout: scope.remainingMs(), signal: scope.signal, wsEndpoint }), {
      stage: 'connect',
      disposeLate: (program) => {
        if (program && typeof program === 'object' && 'disconnect' in program && typeof program.disconnect === 'function') {
          program.disconnect()
        }
      },
    })
  })
}
