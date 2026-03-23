import type { WeappForwardConsoleLogLevel, WeappViteConfig } from '../types'
import { determineAgent } from '@vercel/detect-agent'
import { startForwardConsole as startWechatForwardConsole } from 'weapp-ide-cli'
import logger from '../logger'
import { resolveIdeProjectPath } from './openIde'

export interface ResolvedForwardConsoleOptions {
  enabled: boolean
  logLevels: WeappForwardConsoleLogLevel[]
  unhandledErrors: boolean
  agentName?: string
}

export interface MaybeStartForwardConsoleOptions {
  platform?: string
  mpDistRoot?: string
  cwd?: string
  weappViteConfig?: WeappViteConfig
}

export interface StartForwardConsoleBridgeOptions {
  agentName?: string
  logLevels: WeappForwardConsoleLogLevel[]
  onReadyMessage: string
  projectPath: string
  unhandledErrors: boolean
}

const DEFAULT_FORWARD_CONSOLE_LEVELS: WeappForwardConsoleLogLevel[] = ['log', 'info', 'warn', 'error']
let activeForwardConsoleSession: Awaited<ReturnType<typeof startWechatForwardConsole>> | undefined
const FORWARD_CONSOLE_RETRY_DELAY_MS = 1000
const FORWARD_CONSOLE_RETRY_TIMES = 5

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

  const resolved = await resolveForwardConsoleOptions(options.weappViteConfig)
  if (!resolved.enabled) {
    return false
  }

  if (activeForwardConsoleSession) {
    return true
  }

  try {
    activeForwardConsoleSession = await startForwardConsoleBridge({
      agentName: resolved.agentName,
      projectPath,
      logLevels: resolved.logLevels,
      unhandledErrors: resolved.unhandledErrors,
      onReadyMessage: '[forwardConsole] 已连接微信开发者工具日志',
    })
    return true
  }
  catch (error) {
    activeForwardConsoleSession = undefined
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[forwardConsole] 启动失败，回退到普通 IDE 打开流程：${message}`)
    return false
  }
}

/**
 * @description 统一启动 DevTools 日志桥，并在 IDE 刚启动时做短暂重试。
 */
export async function startForwardConsoleBridge(options: StartForwardConsoleBridgeOptions) {
  return await withForwardConsoleRetry(async () => {
    return await startWechatForwardConsole({
      projectPath: options.projectPath,
      logLevels: options.logLevels,
      unhandledErrors: options.unhandledErrors,
      onReady: () => {
        const suffix = options.agentName ? `（AI 终端：${options.agentName}）` : ''
        logger.info(`${options.onReadyMessage}${suffix}`)
      },
      onLog: (event) => {
        const line = `[mini:${event.level}] ${event.message}`
        if (event.level === 'error') {
          logger.error(line)
          return
        }
        if (event.level === 'warn') {
          logger.warn(line)
          return
        }
        if (event.level === 'info') {
          logger.info(line)
          return
        }
        logger.log(line)
      },
    })
  })
}

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

async function withForwardConsoleRetry<T>(runner: () => Promise<T>): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= FORWARD_CONSOLE_RETRY_TIMES; attempt++) {
    try {
      return await runner()
    }
    catch (error) {
      lastError = error
      if (!isDevtoolsPortNotReadyError(error) || attempt === FORWARD_CONSOLE_RETRY_TIMES) {
        break
      }
      await sleep(FORWARD_CONSOLE_RETRY_DELAY_MS)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function isDevtoolsPortNotReadyError(error: unknown) {
  return error instanceof Error && error.message === 'DEVTOOLS_HTTP_PORT_ERROR'
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
