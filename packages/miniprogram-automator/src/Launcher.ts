import type { AutomatorPortLease } from './launcher/portLease'
import type { MiniprogramAutomatorPlatform } from './platform'
/**
 * @file 开发者工具启动与连接流程。
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import Connection from './Connection'
import { launchHeadlessAutomator } from './headless'
import { endWith, extendDeep, isEmpty, isRelative, isWindows, sleep, waitUntil } from './internal/compat'
import { acquireAutomatorPortLease } from './launcher/portLease'
import { enableAutomatorViaHttp, extractWechatDevtoolsServicePort, resolveWechatDevtoolsBootstrapArgs } from './launcher/wechatCliFallback'
import MiniProgram from './MiniProgram'
import { normalizePlatform } from './platform'
import SwanLauncher from './SwanLauncher'

const DEFAULT_TIMEOUT = 30000
const VERSION_CHECK_TIMEOUT = 30_000
const AUTOMATOR_LAUNCH_RETRIES = 3
const DEFAULT_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER'
const LEGACY_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_E2E_RUNTIME_PROVIDER'
const EXTENSION_CONTEXT_INVALIDATED_RE = /Extension context invalidated/i
const RETRYABLE_LAUNCH_PORT_RE = /Wait timed out after \d+ ms|Failed connecting to ws:\/\/127\.0\.0\.1:\d+|Failed connecting to devtools websocket endpoint|Failed to launch wechat web devTools, please make sure cliPath is correctly specified/i
const WINDOWS_BATCH_CLI_RE = /\.(?:bat|cmd)$/i
let localhostListenPatched = false

function isExtensionContextInvalidatedError(error: unknown) {
  return error instanceof Error && EXTENSION_CONTEXT_INVALIDATED_RE.test(error.message)
}

function isRetryableAutomatorPortLaunchError(error: unknown) {
  return error instanceof Error && RETRYABLE_LAUNCH_PORT_RE.test(error.message)
}

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
/** IConnectOptions 的类型定义。 */
function shouldUseWindowsCommandShell(cliPath: string) {
  return isWindows && WINDOWS_BATCH_CLI_RE.test(cliPath)
}

function escapeWindowsCmdArg(arg: string) {
  const escaped = arg
    .replace(/"/g, '""')
    .replace(/%/g, '%%')
  return /[\s"&<>^|()]/.test(arg) ? `"${escaped}"` : escaped
}

function resolveWindowsBatchSpawn(cliPath: string, args: string[]) {
  const comspec = process.env.ComSpec || 'cmd.exe'
  const commandLine = [cliPath, ...args]
    .map(escapeWindowsCmdArg)
    .join(' ')

  return {
    file: comspec,
    args: ['/d', '/s', '/c', `"${commandLine}"`],
  }
}

export interface IConnectOptions {
  wsEndpoint: string
  timeout?: number
  platform?: MiniprogramAutomatorPlatform
}
/** ILaunchOptions 的类型定义。 */
export interface ILaunchOptions {
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
    if (options.port) {
      return await this.launchWechatDevtools(options)
    }

    let lastError: unknown = null
    for (let attempt = 1; attempt <= AUTOMATOR_LAUNCH_RETRIES; attempt += 1) {
      try {
        return await this.launchWechatDevtools(options)
      }
      catch (error) {
        lastError = error
        if (!isRetryableAutomatorPortLaunchError(error) || attempt === AUTOMATOR_LAUNCH_RETRIES) {
          throw error
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private async launchWechatDevtools(options: ILaunchOptions): Promise<any> {
    const { cliPath = await this.resolveCliPath(), timeout = DEFAULT_TIMEOUT, projectConfig = {}, ticket = '', cwd = '', account = '', trustProject = false } = options
    let { args = [], projectPath } = options
    const portLease = await acquireAutomatorPortLease(options.port)
    let releasePortLeaseOnExit = true
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
      if (isRelative(projectPath)) {
        projectPath = resolvedProjectPath
      }
      const projectExists = await import('node:fs/promises').then(fs => fs.access(resolvedProjectPath).then(() => true).catch(() => false))
      if (!projectExists) {
        throw new Error(`Project path ${resolvedProjectPath} doesn't exist`)
      }
      if (!isEmpty(projectConfig)) {
        await this.extendProjectConfig(projectConfig, resolvedProjectPath)
      }
      let processError: unknown = null
      let processExitCode: number | null = null
      let processSignal: NodeJS.Signals | null = null
      let successfulCliExitSettled = false
      let httpFallbackAttempted = false
      let httpFallbackError: unknown = null
      let targetPort = port
      const cliOutput: string[] = []
      args = resolveWechatDevtoolsBootstrapArgs(args)
      try {
        const spawnTarget = shouldUseWindowsCommandShell(cliPath)
          ? resolveWindowsBatchSpawn(cliPath, args)
          : { file: cliPath, args }
        const child = spawn(spawnTarget.file, spawnTarget.args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: cwd || undefined,
          ...(shouldUseWindowsCommandShell(cliPath)
            ? {
                windowsHide: true,
                windowsVerbatimArguments: true,
              }
            : {}),
        })
        child.on('error', (error) => {
          processError = error
        })
        child.stdout?.on('data', (chunk) => {
          cliOutput.push(String(chunk))
        })
        child.stderr?.on('data', (chunk) => {
          cliOutput.push(String(chunk))
        })
        child.on('exit', (code, signal) => {
          processExitCode = code
          processSignal = signal
          if (code !== 0 || signal) {
            processError = new Error(`DevTools cli exited unexpectedly with code ${code ?? 'null'}${signal ? ` and signal ${signal}` : ''}`)
          }
          else {
            successfulCliExitSettled = true
          }
        })
        child.unref()
      }
      catch (error) {
        processError = error
      }
      let miniProgram: MiniProgram | null = null
      let lastConnectError: unknown = null
      const readinessStartedAt = Date.now()
      const resolveRemainingTimeout = () => Math.max(0, timeout - (Date.now() - readinessStartedAt))
      await waitUntil(async () => {
        try {
          if (processError) {
            return true
          }
          if (successfulCliExitSettled && !httpFallbackAttempted) {
            const servicePort = extractWechatDevtoolsServicePort(cliOutput.join('\n'))
            if (servicePort) {
              httpFallbackAttempted = true
              try {
                targetPort = await enableAutomatorViaHttp({
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
          const candidate = await this.connectTool({
            timeout: Math.min(3_000, connectTimeout),
            wsEndpoint: `ws://127.0.0.1:${targetPort}`,
          })
          try {
            const checkVersionTimeout = resolveRemainingTimeout()
            if (checkVersionTimeout <= 0) {
              candidate.disconnect()
              return false
            }
            await candidate.checkVersion(Math.min(VERSION_CHECK_TIMEOUT, checkVersionTimeout))
            if (typeof candidate.waitForAppReady === 'function') {
              const appReadyTimeout = resolveRemainingTimeout()
              if (appReadyTimeout <= 0) {
                candidate.disconnect()
                return false
              }
              await candidate.waitForAppReady(appReadyTimeout)
            }
          }
          catch (error) {
            candidate.disconnect()
            lastConnectError = error
            if (isExtensionContextInvalidatedError(error)) {
              return false
            }
            throw error
          }
          miniProgram = candidate
          return true
        }
        catch (error) {
          lastConnectError = error
          return false
        }
      }, timeout, 1000)
      if (!miniProgram) {
        if (httpFallbackError) {
          throw httpFallbackError
        }
        if (processError) {
          throw new Error('Failed to launch wechat web devTools, please make sure cliPath is correctly specified')
        }
        if (lastConnectError) {
          throw lastConnectError
        }
        if (processExitCode !== null || processSignal) {
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
      await sleep(5000)
      return resolvedMiniProgram
    }
    finally {
      if (releasePortLeaseOnExit) {
        await portLease.release()
      }
    }
  }

  async connect(options: IConnectOptions) {
    const platform = normalizePlatform(options.platform)
    if (platform === 'swan') {
      return await new SwanLauncher().connect(options)
    }
    const miniProgram = await this.connectTool(options)
    await miniProgram.checkVersion(options.timeout)
    return miniProgram
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
      const connection = await Connection.create(options.wsEndpoint, options.timeout)
      return new MiniProgram(connection)
    }
    catch {
      throw new Error(`Failed connecting to ${options.wsEndpoint}, check if target project window is opened with automation enabled`)
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
