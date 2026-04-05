/**
 * @file 开发者工具启动与连接流程。
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import Connection from './Connection'
import { launchHeadlessAutomator } from './headless'
import { endWith, extendDeep, getPort, isEmpty, isRelative, isWindows, sleep, toStr, waitUntil } from './internal/compat'
import MiniProgram from './MiniProgram'

const DEFAULT_PORT = 9420
const DEFAULT_TIMEOUT = 30000
const DEFAULT_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER'
const LEGACY_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_E2E_RUNTIME_PROVIDER'
const EXTENSION_CONTEXT_INVALIDATED_RE = /Extension context invalidated/i
let localhostListenPatched = false

function isExtensionContextInvalidatedError(error: unknown) {
  return error instanceof Error && EXTENSION_CONTEXT_INVALIDATED_RE.test(error.message)
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
export interface IConnectOptions {
  wsEndpoint: string
}
/** ILaunchOptions 的类型定义。 */
export interface ILaunchOptions {
  cliPath?: string
  timeout?: number
  port?: number
  account?: string
  ticket?: string
  projectConfig?: any
  projectPath: string
  trustProject?: boolean
  args?: string[]
  cwd?: string
  runtimeProvider?: 'devtools' | 'headless'
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
    const provider = resolveRuntimeProvider(options)
    if (provider === 'headless') {
      return await launchHeadlessAutomator({
        projectPath: options.projectPath,
      })
    }
    patchNetListenToLoopback()
    const { cliPath = await this.resolveCliPath(), timeout = DEFAULT_TIMEOUT, projectConfig = {}, ticket = '', cwd = '', account = '', trustProject = false } = options
    let { args = [], projectPath } = options
    const port = await getPort(options.port || DEFAULT_PORT)
    if (options.port && options.port !== port) {
      throw new Error(`Port ${options.port} is in use, please specify another port`)
    }
    if (!cliPath) {
      throw new Error('Wechat web devTools not found, please specify cliPath option')
    }
    if (isWindows && endWith(cliPath, '.exe')) {
      throw new Error('cliPath is not correct, it\'s usually named as \'cli\' or \'cli.bat\'')
    }
    if (!projectPath) {
      throw new Error('projectPath is not provided')
    }
    if (isRelative(projectPath)) {
      projectPath = path.resolve(projectPath)
    }
    const projectExists = await import('node:fs/promises').then(fs => fs.access(projectPath).then(() => true).catch(() => false))
    if (!projectExists) {
      throw new Error(`Project path ${projectPath} doesn't exist`)
    }
    if (!isEmpty(projectConfig)) {
      await this.extendProjectConfig(projectConfig, projectPath)
    }
    let processError: unknown = null
    let exited = false
    args = [
      ...args,
      'auto',
      '--project',
      projectPath,
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
      const child = spawn(cliPath, args, {
        stdio: 'ignore',
        cwd: cwd || undefined,
      })
      child.on('error', (error) => {
        processError = error
      })
      child.on('exit', () => {
        setTimeout(() => {
          exited = true
        }, 15000)
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
        if (processError || exited) {
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
      if (exited) {
        throw new Error('Failed to launch wechat web devTools, please make sure http port is open')
      }
      throw new Error('Failed connecting to devtools websocket endpoint')
    }
    const resolvedMiniProgram = miniProgram as MiniProgram
    await sleep(5000)
    return resolvedMiniProgram
  }

  async connect(options: IConnectOptions) {
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
