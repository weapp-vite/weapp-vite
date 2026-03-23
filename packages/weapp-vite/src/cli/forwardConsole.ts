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
  weappViteConfig?: WeappViteConfig
}

const DEFAULT_FORWARD_CONSOLE_LEVELS: WeappForwardConsoleLogLevel[] = ['log', 'info', 'warn', 'error']
let activeForwardConsoleSession: Awaited<ReturnType<typeof startWechatForwardConsole>> | undefined

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

  const projectPath = resolveIdeProjectPath(options.mpDistRoot)
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
    activeForwardConsoleSession = await startWechatForwardConsole({
      projectPath,
      logLevels: resolved.logLevels,
      unhandledErrors: resolved.unhandledErrors,
      onReady: () => {
        const suffix = resolved.agentName ? `（AI 终端：${resolved.agentName}）` : ''
        logger.info(`[forwardConsole] 已连接微信开发者工具日志${suffix}`)
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
    return true
  }
  catch (error) {
    activeForwardConsoleSession = undefined
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[forwardConsole] 启动失败，回退到普通 IDE 打开流程：${message}`)
    return false
  }
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
