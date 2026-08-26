import type { WeappForwardConsoleLogLevel, WeappViteConfig } from '../types'
import process from 'node:process'
import { determineAgent } from '@vercel/detect-agent'
import { isRetryableAutomatorLaunchError, resolveProjectAutomatorPort, startForwardConsole as startWechatForwardConsole } from 'weapp-ide-cli'
import logger, { colors } from '../logger'
import { resolveIdeProjectPath, shouldUseAutomatorProjectWrapper } from './openIde'

export interface ResolvedForwardConsoleOptions {
  enabled: boolean
  logLevels: WeappForwardConsoleLogLevel[]
  unhandledErrors: boolean
  agentName?: string
}

export interface MaybeStartForwardConsoleOptions {
  openedOnly?: boolean
  preferOpenedSession?: boolean
  preserveProjectRoot?: boolean
  recoverAutomatorSession?: () => Promise<void>
  platform?: string
  mpDistRoot?: string
  cwd?: string
  weappViteConfig?: WeappViteConfig
}

export interface StartForwardConsoleBridgeOptions {
  agentName?: string
  color?: boolean
  logLevels: WeappForwardConsoleLogLevel[]
  onReadyMessage: string
  openedOnly?: boolean
  preferOpenedSession?: boolean
  preserveProjectRoot?: boolean
  port?: number
  projectPath: string
  timeout?: number
  unhandledErrors: boolean
}

const DEFAULT_FORWARD_CONSOLE_LEVELS: WeappForwardConsoleLogLevel[] = ['log', 'info', 'warn', 'error']
let activeForwardConsoleSession: Awaited<ReturnType<typeof startWechatForwardConsole>> | undefined
let activeForwardConsoleBridgeOptions: StartForwardConsoleBridgeOptions | undefined
let activeForwardConsoleStart: Promise<boolean> | undefined
let forwardConsoleLifecycle = 0
const FORWARD_CONSOLE_RETRY_DELAY_MS = 1000
const FORWARD_CONSOLE_RETRY_TIMES = 5
const FORWARD_CONSOLE_RETRY_WINDOW_MS = 10_000
const FORWARD_CONSOLE_RECOVERABLE_START_TIMEOUT_MS = 60_000
const FORWARD_CONSOLE_START_TIMEOUT_MS = 120_000

async function detectAgent() {
  try {
    const result = await determineAgent()
    return {
      isAgent: result.isAgent,
      agentName: result.isAgent ? result.agent.name : undefined,
    }
  }
  catch {
    return {
      isAgent: false,
      agentName: undefined,
    }
  }
}

function formatForwardConsolePrefix(level: WeappForwardConsoleLogLevel, color: boolean) {
  const label = `[mini:${level.padEnd(5)}]`
  if (!color) {
    return label
  }
  if (level === 'error') {
    return colors.bold(colors.red(label))
  }
  if (level === 'warn') {
    return colors.bold(colors.yellow(label))
  }
  if (level === 'info') {
    return colors.bold(colors.cyan(label))
  }
  if (level === 'debug') {
    return colors.dim(label)
  }
  return colors.bold(colors.green(label))
}

function formatForwardConsoleMessage(level: WeappForwardConsoleLogLevel, message: string, color: boolean) {
  if (!color) {
    return message
  }
  if (level === 'error') {
    return colors.red(message)
  }
  if (level === 'warn') {
    return colors.yellow(message)
  }
  if (level === 'debug') {
    return colors.dim(message)
  }
  return message
}

function writeForwardConsoleLine(line: string) {
  process.stdout.write(`${line}\n`)
}

function isDevtoolsPortNotReadyError(error: unknown) {
  return error instanceof Error && (
    error.message === 'DEVTOOLS_HTTP_PORT_ERROR'
    || error.message === 'DEVTOOLS_WS_CONNECT_ERROR'
    || error.message === 'DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED'
  )
}

function isDevtoolsProtocolTimeoutError(error: unknown) {
  return error instanceof Error && (
    error.message === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    || /DevTools did not respond to protocol method \S+ within \d+ms/i.test(error.message)
  )
}

function isRecoverableAutomatorStartError(error: unknown) {
  return isDevtoolsPortNotReadyError(error)
    || isDevtoolsProtocolTimeoutError(error)
    || isRetryableAutomatorLaunchError(error)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withForwardConsoleRetry<T>(runner: () => Promise<T>): Promise<T> {
  let lastError: unknown
  const startedAt = Date.now()

  for (let attempt = 0; attempt <= FORWARD_CONSOLE_RETRY_TIMES; attempt++) {
    try {
      return await runner()
    }
    catch (error) {
      lastError = error
      if (
        !isDevtoolsPortNotReadyError(error)
        || attempt === FORWARD_CONSOLE_RETRY_TIMES
        || Date.now() - startedAt >= FORWARD_CONSOLE_RETRY_WINDOW_MS
      ) {
        break
      }
      await sleep(FORWARD_CONSOLE_RETRY_DELAY_MS)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * @description 解析 forwardConsole 配置，并在 auto 模式下检测 AI 终端。
 */
export async function resolveForwardConsoleOptions(
  config?: WeappViteConfig,
): Promise<ResolvedForwardConsoleOptions> {
  const rawConfig = config?.forwardConsole
  const defaults = {
    logLevels: DEFAULT_FORWARD_CONSOLE_LEVELS,
    unhandledErrors: true,
  }

  if (rawConfig === false) {
    return {
      enabled: false,
      ...defaults,
    }
  }

  if (rawConfig === true) {
    return {
      enabled: true,
      ...defaults,
    }
  }

  const normalizedConfig = rawConfig ?? {}
  const enabledMode = normalizedConfig.enabled ?? 'auto'
  const logLevels = normalizedConfig.logLevels?.length
    ? normalizedConfig.logLevels
    : defaults.logLevels
  const unhandledErrors = normalizedConfig.unhandledErrors ?? defaults.unhandledErrors

  if (enabledMode === true) {
    return {
      enabled: true,
      logLevels,
      unhandledErrors,
    }
  }

  if (enabledMode === false) {
    return {
      enabled: false,
      logLevels,
      unhandledErrors,
    }
  }

  const agentResult = await detectAgent()
  return {
    enabled: agentResult.isAgent,
    agentName: agentResult.agentName,
    logLevels,
    unhandledErrors,
  }
}

/**
 * @description 统一启动 DevTools 日志桥，并在 IDE 刚启动时做短暂重试。
 */
export async function startForwardConsoleBridge(options: StartForwardConsoleBridgeOptions) {
  return await withForwardConsoleRetry(async () => {
    const color = options.color ?? true
    return await startWechatForwardConsole({
      projectPath: options.projectPath,
      logLevels: options.logLevels,
      openedOnly: options.openedOnly,
      preferOpenedSession: options.preferOpenedSession,
      preserveProjectRoot: options.preserveProjectRoot,
      port: options.port,
      timeout: options.timeout,
      unhandledErrors: options.unhandledErrors,
      onReady: () => {
        const suffix = options.agentName ? `（AI 终端：${options.agentName}）` : ''
        logger.info(`${options.onReadyMessage}${suffix}`)
      },
      onLog: (event) => {
        const line = `${formatForwardConsolePrefix(event.level, color)} ${formatForwardConsoleMessage(event.level, event.message, color)}`
        writeForwardConsoleLine(line)
      },
    })
  })
}

/**
 * @description 暂停当前 DevTools 日志桥，并返回恢复函数。
 */
export async function pauseActiveForwardConsole() {
  const session = activeForwardConsoleSession
  const bridgeOptions = activeForwardConsoleBridgeOptions
  if (!session || !bridgeOptions) {
    return undefined
  }

  activeForwardConsoleSession = undefined
  activeForwardConsoleBridgeOptions = undefined
  await session.close()

  return async () => {
    if (activeForwardConsoleSession) {
      return true
    }
    try {
      activeForwardConsoleSession = await startForwardConsoleBridge(bridgeOptions)
      activeForwardConsoleBridgeOptions = bridgeOptions
      return true
    }
    catch (error) {
      activeForwardConsoleSession = undefined
      activeForwardConsoleBridgeOptions = undefined
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[forwardConsole] 恢复失败：${message}`)
      return false
    }
  }
}

/**
 * @description 关闭当前 DevTools 日志桥并释放共享 automator 会话。
 */
export async function closeActiveForwardConsole() {
  forwardConsoleLifecycle += 1
  const session = activeForwardConsoleSession
  const pendingStart = activeForwardConsoleStart
  activeForwardConsoleSession = undefined
  activeForwardConsoleBridgeOptions = undefined
  await session?.close()
  await pendingStart?.catch(() => {})
}

/**
 * @description 在 weapp 开发态按需启动控制台转发。
 */
export async function maybeStartForwardConsole(options: MaybeStartForwardConsoleOptions) {
  if (options.platform !== 'weapp') {
    return false
  }

  const projectPath = resolveIdeProjectPath(options.mpDistRoot) ?? options.cwd
  if (!projectPath) {
    return false
  }

  if (activeForwardConsoleSession) {
    return true
  }
  if (activeForwardConsoleStart) {
    return await activeForwardConsoleStart
  }

  const lifecycle = forwardConsoleLifecycle
  const startTask = (async () => {
    const resolved = await resolveForwardConsoleOptions(options.weappViteConfig)
    if (!resolved.enabled || lifecycle !== forwardConsoleLifecycle) {
      return false
    }

    const bridgeOptions: StartForwardConsoleBridgeOptions = {
      agentName: resolved.agentName,
      color: !resolved.agentName,
      projectPath,
      port: resolveProjectAutomatorPort(projectPath),
      timeout: options.recoverAutomatorSession
        ? FORWARD_CONSOLE_RECOVERABLE_START_TIMEOUT_MS
        : FORWARD_CONSOLE_START_TIMEOUT_MS,
      logLevels: resolved.logLevels,
      openedOnly: options.openedOnly,
      preferOpenedSession: options.preferOpenedSession,
      preserveProjectRoot: options.preserveProjectRoot ?? !shouldUseAutomatorProjectWrapper(projectPath),
      unhandledErrors: resolved.unhandledErrors,
      onReadyMessage: '[forwardConsole] 已连接微信开发者工具日志',
    }

    const activateSession = async (
      session: Awaited<ReturnType<typeof startForwardConsoleBridge>>,
      activeOptions: StartForwardConsoleBridgeOptions,
    ) => {
      if (lifecycle !== forwardConsoleLifecycle) {
        await session.close()
        return false
      }
      activeForwardConsoleSession = session
      activeForwardConsoleBridgeOptions = activeOptions
      return true
    }

    const recoverAutomatorSession = async () => {
      try {
        await options.recoverAutomatorSession?.()
        if (lifecycle !== forwardConsoleLifecycle) {
          return false
        }
        const recoveredOptions: StartForwardConsoleBridgeOptions = {
          ...bridgeOptions,
          openedOnly: true,
          preferOpenedSession: true,
        }
        return await activateSession(
          await startForwardConsoleBridge(recoveredOptions),
          recoveredOptions,
        )
      }
      catch (recoveryError) {
        if (lifecycle !== forwardConsoleLifecycle) {
          return false
        }
        const message = recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        logger.warn(`[forwardConsole] automator 会话恢复失败，回退到普通 IDE 打开流程：${message}`)
        return false
      }
    }

    try {
      return await activateSession(
        await startForwardConsoleBridge(bridgeOptions),
        bridgeOptions,
      )
    }
    catch (error) {
      if (lifecycle !== forwardConsoleLifecycle) {
        return false
      }
      if (
        options.recoverAutomatorSession
        && isRecoverableAutomatorStartError(error)
      ) {
        return await recoverAutomatorSession()
      }
      if (!isDevtoolsPortNotReadyError(error)) {
        const message = error instanceof Error ? error.message : String(error)
        logger.warn(`[forwardConsole] 启动失败，回退到普通 IDE 打开流程：${message}`)
        return false
      }

      const fallbackOptions: StartForwardConsoleBridgeOptions = {
        ...bridgeOptions,
        openedOnly: true,
        port: undefined,
        preferOpenedSession: true,
      }
      try {
        return await activateSession(
          await startForwardConsoleBridge(fallbackOptions),
          fallbackOptions,
        )
      }
      catch (fallbackError) {
        if (lifecycle !== forwardConsoleLifecycle) {
          return false
        }
        const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        logger.warn(`[forwardConsole] 启动失败，回退到普通 IDE 打开流程：${message}`)
        return false
      }
    }
  })()

  activeForwardConsoleStart = startTask
  try {
    return await startTask
  }
  finally {
    if (activeForwardConsoleStart === startTask) {
      activeForwardConsoleStart = undefined
    }
  }
}
