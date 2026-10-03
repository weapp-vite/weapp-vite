import type { AutomatorPortLease } from './launcher/portLease'
import type { MiniprogramAutomatorPlatform } from './platform'
/**
 * @file 开发者工具启动与连接流程。
 */
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import Connection from './Connection'
import { launchHeadlessAutomator } from './headless'
import { endWith, extendDeep, isEmpty, isRelative, isWindows, waitUntil } from './internal/compat'
import { acquireAutomatorPortLease } from './launcher/portLease'
import { spawnWechatCli } from './launcher/process'
import { enableAutomatorViaHttp, extractWechatDevtoolsServicePort } from './launcher/wechatCliFallback'
import MiniProgram from './MiniProgram'
import { isRecoverableOperationError, OperationLifecycle, readWechatLoginState } from './operation'
import { normalizePlatform } from './platform'
import SwanLauncher from './SwanLauncher'

const DEFAULT_TIMEOUT = 30000
const VERSION_CHECK_TIMEOUT = 30_000
const AUTOMATOR_LAUNCH_RETRIES = 3
const DEFAULT_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER'
const LEGACY_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_E2E_RUNTIME_PROVIDER'
let localhostListenPatched = false

function retainPortLeaseUntilSessionClose(miniProgram: MiniProgram, portLease: AutomatorPortLease) {
  let released = false
  const release = async () => {
    if (released) {
      return
    }
    released = true
    await portLease.release()
  }

  const target = miniProgram as Omit<MiniProgram, 'close' | 'disconnect'> & {
    close?: () => Promise<void>
    disconnect?: () => void
  }
  const rawClose = target.close
  const rawDisconnect = target.disconnect
  if (typeof rawClose !== 'function' && typeof rawDisconnect !== 'function') {
    return false
  }

  if (typeof rawDisconnect === 'function') {
    target.disconnect = function disconnectWithPortLeaseRelease() {
      try {
        return rawDisconnect.call(this)
      }
      finally {
        void release()
      }
    }
  }

  if (typeof rawClose === 'function') {
    target.close = async function closeWithPortLeaseRelease() {
      try {
        return await rawClose.call(this)
      }
      finally {
        await release()
      }
    }
  }

  return true
}

function patchNetListenToLoopback() {
  if (localhostListenPatched) {
    return
  }
  localhostListenPatched = true
  const rawListen = net.Server.prototype.listen
  net.Server.prototype.listen = function patchedListen(this: net.Server, ...args: any[]) {
    const firstArg = args[0]
    if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg)) {
      if (!('host' in firstArg) || !firstArg.host) {
        args[0] = {
          ...firstArg,
          host: '127.0.0.1',
        }
      }
      return rawListen.apply(this, args as any)
    }
    if ((typeof firstArg === 'number' || typeof firstArg === 'string') && typeof args[1] !== 'string') {
      args.splice(1, 0, '127.0.0.1')
    }
    return rawListen.apply(this, args as any)
  } as typeof net.Server.prototype.listen
}
export interface IConnectOptions {
  wsEndpoint: string
  signal?: AbortSignal
  timeout?: number
  platform?: MiniprogramAutomatorPlatform
}
/** ILaunchOptions 的类型定义。 */
export interface ILaunchOptions {
  signal?: AbortSignal
  platform?: MiniprogramAutomatorPlatform
  cliPath?: string
  connectType?: string
  deviceId?: string
  deviceType?: string
  devtoolsPath?: string
  timeout?: number
  port?: number
  account?: string
  ticket?: string
  projectConfig?: any
  projectPath?: string
  projectMinVersion?: string
  swanCoreVersion?: string
  trustProject?: boolean
  args?: string[]
  browserPath?: string
  containerInfo?: unknown
  cookies?: unknown
  cwd?: string
  headless?: boolean
  isRecord?: boolean
  mtpaas?: Record<string, unknown>
  runtimeProvider?: 'devtools' | 'headless'
  wdaProjPath?: string
  webModel?: string
}

export interface ILauncherSessionMetadata {
  port: number
  projectPath: string
  wsEndpoint: string
}
function resolveRuntimeProvider(options: ILaunchOptions) {
  return options.runtimeProvider
    || process.env[DEFAULT_RUNTIME_PROVIDER_ENV]
    || process.env[LEGACY_RUNTIME_PROVIDER_ENV]
    || 'devtools'
}
/** Launcher 的实现。 */
export default class Launcher {
  async launch(options: ILaunchOptions): Promise<any> {
    const platform = normalizePlatform(options.platform)
    if (platform === 'swan') {
      return await new SwanLauncher().launch(options)
    }
    const provider = resolveRuntimeProvider(options)
    if (provider === 'headless') {
      if (!options.projectPath) {
        throw new Error('projectPath is not provided')
      }
      return await launchHeadlessAutomator({
        projectPath: options.projectPath,
      })
    }
    patchNetListenToLoopback()
    const lifecycle = new OperationLifecycle(options.timeout ?? DEFAULT_TIMEOUT, 'automator launch', options.signal)
    return await lifecycle.run(async (scope) => {
      const attempts = options.port ? 1 : AUTOMATOR_LAUNCH_RETRIES
      for (let attempt = 1; ; attempt += 1) {
        scope.attempt()
        try {
          return await scope.step(() => this.launchWechatDevtools(options, scope))
        }
        catch (error) {
          scope.recordFailure(error)
          scope.throwIfAborted()
          if (!isRecoverableOperationError(error) || attempt >= attempts) {
            throw error
          }
        }
      }
    })
  }

  private async launchWechatDevtools(options: ILaunchOptions, scope: OperationLifecycle): Promise<any> {
    const { cliPath = await scope.step(() => this.resolveCliPath(), { stage: 'resolve-cli' }), projectConfig = {}, ticket = '', cwd = '', account = '', trustProject = false } = options
    const { args = [], projectPath } = options
    const portLease = await scope.step(() => acquireAutomatorPortLease(options.port), { stage: 'port-lease', disposeLate: lease => lease.release() })
    const rawReleaseLease = portLease.release.bind(portLease)
    let releasedLease: Promise<void> | undefined
    portLease.release = () => releasedLease ??= rawReleaseLease()
    const disownLease = scope.own(() => portLease.release(), 'port-lease')
    let releasePortLeaseOnExit = true
    let releaseChild = async () => {}
    try {
      const port = portLease.port
      if (!cliPath) {
        throw new Error('Wechat web devTools not found, please specify cliPath option')
      }
      if (isWindows && endWith(cliPath, '.exe')) {
        throw new Error('cliPath is not correct, it\'s usually named as \'cli\' or \'cli.bat\'')
      }
      if (!projectPath) {
        throw new Error('projectPath is not provided')
      }
      const resolvedProjectPath = isRelative(projectPath) ? path.resolve(projectPath) : projectPath
      const projectExists = await scope.step(() => import('node:fs/promises').then(fs => fs.access(resolvedProjectPath).then(() => true).catch(() => false)), { stage: 'project' })
      if (!projectExists) {
        throw new Error(`Project path ${resolvedProjectPath} doesn't exist`)
      }
      if (!isEmpty(projectConfig)) {
        await scope.step(() => this.extendProjectConfig(projectConfig, resolvedProjectPath), { stage: 'project-config' })
      }
      scope.throwIfAborted()
      let httpFallbackAttempted = false
      let httpFallbackError: unknown = null
      let targetPort = port
      const cli = spawnWechatCli(cliPath, args, cwd, scope)
      releaseChild = cli.release
      let miniProgram: MiniProgram | null = null
      let lastConnectError: unknown = null
      const resolveRemainingTimeout = () => scope.remainingMs()
      await scope.step(() => waitUntil(async () => {
        scope.throwIfAborted()
        try {
          if (cli.error) {
            return true
          }
          if (cli.success && readWechatLoginState(cli.output) === false) {
            throw Object.assign(new Error('DEVTOOLS_LOGIN_REQUIRED: need re-login'), { code: 10 })
          }
          if (cli.success && !httpFallbackAttempted) {
            const servicePort = extractWechatDevtoolsServicePort(cli.output)
            if (servicePort) {
              httpFallbackAttempted = true
              try {
                targetPort = await enableAutomatorViaHttp({
                  signal: scope.signal,
                  account,
                  autoPort: port,
                  projectPath: resolvedProjectPath,
                  servicePort,
                  ticket,
                  trustProject,
                })
              }
              catch (error) {
                httpFallbackError = error
                return true
              }
            }
          }
          const connectTimeout = resolveRemainingTimeout()
          if (connectTimeout <= 0) {
            return false
          }
          const candidate = await scope.step(() => this.connectTool({
            signal: scope.signal,
            timeout: Math.min(3_000, connectTimeout),
            wsEndpoint: `ws://127.0.0.1:${targetPort}`,
          }), { stage: 'websocket', disposeLate: program => program.disconnect() })
          let releasedCandidate = false
          const releaseCandidate = () => {
            if (!releasedCandidate) {
              releasedCandidate = true
              candidate.disconnect()
            }
          }
          const disownCandidate = scope.own(releaseCandidate, 'websocket')
          try {
            const checkVersionTimeout = resolveRemainingTimeout()
            if (checkVersionTimeout <= 0) {
              releaseCandidate()
              return false
            }
            await scope.step(() => candidate.checkVersion(Math.min(VERSION_CHECK_TIMEOUT, checkVersionTimeout)), { stage: 'version' })
            if (typeof candidate.waitForAppReady === 'function') {
              const appReadyTimeout = resolveRemainingTimeout()
              if (appReadyTimeout <= 0) {
                releaseCandidate()
                return false
              }
              await scope.step(() => candidate.waitForAppReady(appReadyTimeout), { stage: 'app-ready' })
            }
          }
          catch (error) {
            disownCandidate()
            releaseCandidate()
            lastConnectError = error
            if (isRecoverableOperationError(error)) {
              return false
            }
            throw error
          }
          miniProgram = candidate
          return true
        }
        catch (error) {
          lastConnectError = error
          scope.recordFailure(error)
          scope.throwIfAborted()
          if (!isRecoverableOperationError(error)) {
            throw error
          }
          return false
        }
      }, scope.remainingMs(), 1000, scope.signal), { stage: 'readiness' })
      if (!miniProgram) {
        if (httpFallbackError) {
          throw httpFallbackError
        }
        if (cli.error) {
          throw new Error('Failed to launch wechat web devTools, please make sure cliPath is correctly specified', { cause: cli.error })
        }
        if (lastConnectError) {
          throw lastConnectError
        }
        if (cli.exited) {
          throw new Error('Failed to launch wechat web devTools, please make sure http port is open')
        }
        throw new Error('Failed connecting to devtools websocket endpoint')
      }
      const resolvedMiniProgram = miniProgram as MiniProgram
      Reflect.set(resolvedMiniProgram, '__WEAPP_VITE_SESSION_METADATA', {
        port: targetPort,
        projectPath: resolvedProjectPath,
        wsEndpoint: `ws://127.0.0.1:${targetPort}`,
      } satisfies ILauncherSessionMetadata)
      releasePortLeaseOnExit = !retainPortLeaseUntilSessionClose(resolvedMiniProgram, portLease)
      disownLease()
      return resolvedMiniProgram
    }
    finally {
      await releaseChild()
      if (releasePortLeaseOnExit) {
        disownLease()
        await portLease.release()
      }
    }
  }

  async connect(options: IConnectOptions) {
    const platform = normalizePlatform(options.platform)
    if (platform === 'swan') {
      return await new SwanLauncher().connect(options)
    }
    const lifecycle = new OperationLifecycle(options.timeout ?? DEFAULT_TIMEOUT, 'automator connect', options.signal)
    return await lifecycle.run(async (scope) => {
      scope.attempt()
      const miniProgram = await scope.step(() => this.connectTool({ ...options, signal: scope.signal, timeout: scope.remainingMs() }), {
        stage: 'websocket',
        disposeLate: program => program.disconnect(),
      })
      scope.own(() => miniProgram.disconnect(), 'websocket')
      await scope.step(() => miniProgram.checkVersion(scope.remainingMs()), { stage: 'version' })
      return miniProgram
    })
  }

  private async extendProjectConfig(projectConfig: any, projectPath: string) {
    const projectConfigPath = path.resolve(projectPath, 'project.config.json')
    const fs = await import('node:fs/promises')
    const raw = await fs.readFile(projectConfigPath, 'utf8')
    const current = JSON.parse(raw)
    extendDeep(current, projectConfig)
    await fs.writeFile(projectConfigPath, JSON.stringify(current, null, 2), 'utf8')
  }

  private async connectTool(options: IConnectOptions) {
    try {
      const connection = await Connection.create(options.wsEndpoint, options.timeout, options.signal)
      return new MiniProgram(connection)
    }
    catch (cause) {
      throw new Error(`Failed connecting to ${options.wsEndpoint}, check if target project window is opened with automation enabled`, { cause })
    }
  }

  private async resolveCliPath() {
    const fs = await import('node:fs/promises')
    const cliPath = isWindows
      ? 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
      : '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
    try {
      await fs.access(cliPath)
      return cliPath
    }
    catch {
      return ''
    }
  }
}
