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
import { endWith, extendDeep, isEmpty, isRelative, isWindows, sleep, toStr, waitUntil } from './internal/compat'
import { acquireAutomatorPortLease } from './launcher/portLease'
import MiniProgram from './MiniProgram'
import { normalizePlatform } from './platform'
import SwanLauncher from './SwanLauncher'

const DEFAULT_TIMEOUT = 30000
const AUTOMATOR_LAUNCH_RETRIES = 3
const DEFAULT_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER'
const LEGACY_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_E2E_RUNTIME_PROVIDER'
const EXTENSION_CONTEXT_INVALIDATED_RE = /Extension context invalidated/i
const RETRYABLE_LAUNCH_PORT_RE = /Wait timed out after \d+ ms|Failed connecting to ws:\/\/127\.0\.0\.1:\d+|Failed connecting to devtools websocket endpoint/i
const WINDOWS_BATCH_CLI_RE = /\.(?:bat|cmd)$/i
let localhostListenPatched = false

function isExtensionContextInvalidatedError(error: unknown) {
  return error instanceof Error && EXTENSION_CONTEXT_INVALIDATED_RE.test(error.message)
}

function isRetryableAutomatorPortLaunchError(error: unknown) {
  return error instanceof Error && RETRYABLE_LAUNCH_PORT_RE.test(error.message)
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
      args = [
        ...args,
        'auto',
        '--project',
        resolvedProjectPath,
        '--auto-port',
        toStr(port),
      ]
      if (account) {
        args.push('--auto-account', account)
      }
      else if (ticket) {
        args.push('--ticket', ticket)
      }
      if (trustProject) {
        args.push('--trust-project')
      }
      try {
        const spawnTarget = shouldUseWindowsCommandShell(cliPath)
          ? resolveWindowsBatchSpawn(cliPath, args)
          : { file: cliPath, args }
        const child = spawn(spawnTarget.file, spawnTarget.args, {
          stdio: 'ignore',
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
        child.on('exit', (code, signal) => {
          processExitCode = code
          processSignal = signal
          if (code !== 0 || signal) {
            processError = new Error(`DevTools cli exited unexpectedly with code ${code ?? 'null'}${signal ? ` and signal ${signal}` : ''}`)
          }
        })
        child.unref()
      }
      catch (error) {
        processError = error
      }
      let miniProgram: MiniProgram | null = null
      let lastConnectError: unknown = null
      await waitUntil(async () => {
        try {
          if (processError) {
            return true
          }
          const candidate = await this.connectTool({
            wsEndpoint: `ws://127.0.0.1:${port}`,
          })
          try {
            await candidate.checkVersion()
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
        port,
        projectPath: resolvedProjectPath,
        wsEndpoint: `ws://127.0.0.1:${port}`,
      } satisfies ILauncherSessionMetadata)
      await sleep(5000)
      return resolvedMiniProgram
    }
    finally {
      await portLease.release()
    }
  }

  async connect(options: IConnectOptions) {
    const platform = normalizePlatform(options.platform)
    if (platform === 'swan') {
      return await new SwanLauncher().connect(options)
    }
    const miniProgram = await this.connectTool(options)
    await miniProgram.checkVersion()
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
      const connection = await Connection.create(options.wsEndpoint)
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
