import type { MpPlatform } from '../types'
import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'
import path from 'pathe'
import {
  connectOpenedAutomator,
  formatRetryHotkeyPrompt,
  formatWechatIdeLoginRequiredError,
  getConfig,
  isWechatIdeLoginRequiredError,
  launchAutomator,
  parse,
  waitForRetryKeypress,
} from 'weapp-ide-cli'
import { createCompilerContext } from '../createContext'
import logger, { colors } from '../logger'
import {
  getDefaultIdeProjectRoot,
  shouldPassPlatformArgToIdeOpen,
} from '../platform'
import { createInlineConfig } from './runtime'

const execFileAsync = promisify(execFile)

export interface ResolveIdeCommandOptions {
  configFile?: string
  cwd?: string
  mode?: string
  platform?: MpPlatform
  projectPath?: string
  cliPlatform?: string
}

export interface ResolvedIdeCommandContext {
  platform?: MpPlatform
  projectPath?: string
  weappViteConfig?: Awaited<ReturnType<typeof createCompilerContext>>['configService']['weappViteConfig']
  mpDistRoot?: string
}

export interface OpenIdeOptions {
  trustProject?: boolean
}

async function openWechatIdeByAutomator(projectPath: string) {
  const miniProgram = await launchAutomator({
    projectPath,
    trustProject: true,
  })
  miniProgram.disconnect()
}

/**
 * @description 执行 IDE 打开流程，并在登录失效时允许按键重试。
 */
async function runWechatIdeOpenWithRetry(argv: string[]) {
  let retrying = true

  while (retrying) {
    try {
      await parse(argv)
      return
    }
    catch (error) {
      if (!isWechatIdeLoginRequiredError(error)) {
        logger.error(error)
        return
      }

      logger.error('检测到微信开发者工具登录状态失效，请先登录后重试。')
      logger.warn(formatWechatIdeLoginRequiredError(error))

      logger.info(formatRetryHotkeyPrompt())
      const action = await waitForRetryKeypress()

      if (action !== 'retry') {
        logger.warn('已取消重试。完成登录后请重新执行当前命令。')
        retrying = false
        continue
      }

      logger.info(colors.bold(colors.green('正在重试连接微信开发者工具...')))
    }
  }
}

async function closeIdeByAppleScript() {
  if (process.platform !== 'darwin') {
    return false
  }

  const appName = process.env.WEAPP_DEVTOOLS_APP_NAME || 'wechatwebdevtools'
  try {
    await execFileAsync('osascript', ['-e', `tell application "${appName}" to quit`])
    return true
  }
  catch {
    return false
  }
}

async function closeIdeByProcessKill(cliPath: string | null) {
  if (!cliPath) {
    return false
  }

  const appContentsRoot = cliPath.includes('.app/')
    ? cliPath.slice(0, cliPath.indexOf('.app/') + '.app'.length)
    : path.dirname(path.dirname(cliPath))

  try {
    await execFileAsync('pkill', ['-f', appContentsRoot])
    return true
  }
  catch {
    return false
  }
}

/**
 * @description 根据 mpDistRoot 推导 IDE 项目目录（目录内应包含 project/mini 配置）
 */
export function resolveIdeProjectPath(mpDistRoot?: string) {
  if (!mpDistRoot || !mpDistRoot.trim()) {
    return undefined
  }
  const parent = path.dirname(mpDistRoot)
  if (!parent || parent === '.' || parent === '/') {
    return undefined
  }
  return parent
}

/**
 * @description 结合 mpDistRoot 与配置根目录解析最终 IDE 项目目录。
 */
export function resolveIdeProjectRoot(mpDistRoot?: string, cwd?: string) {
  return resolveIdeProjectPath(mpDistRoot) ?? cwd
}

export async function closeIde() {
  const config = await getConfig()
  const cliPath = config.cliPath?.trim() ? config.cliPath : null

  try {
    await parse(['close'])
    return true
  }
  catch (error) {
    if (isWechatIdeLoginRequiredError(error)) {
      try {
        await runWechatIdeOpenWithRetry(['close'])
        return true
      }
      catch (retryError) {
        logger.error(retryError)
      }
    }
    else {
      logger.warn('微信开发者工具 CLI close 执行失败，尝试回退为系统级关闭。')
      logger.error(error)
    }

    if (await closeIdeByAppleScript()) {
      logger.info('已回退为系统级关闭微信开发者工具。')
      return true
    }

    if (await closeIdeByProcessKill(cliPath)) {
      logger.info('已回退为进程级关闭微信开发者工具。')
      return true
    }

    return false
  }
}

function formatReuseOpenedWechatIdePrompt() {
  const highlightedRetryKey = colors.bold(colors.green('r'))
  return `目标项目已在微信开发者工具中打开，已跳过重复打开。按 ${highlightedRetryKey} 关闭当前窗口后重新打开。`
}

/**
 * @description 若当前项目已在微信开发者工具中打开且自动化可连通，则直接复用现有会话，避免重复拉起 IDE。
 */
async function tryReuseOpenedWechatIde(projectPath: string) {
  let miniProgram: Awaited<ReturnType<typeof connectOpenedAutomator>> | undefined
  try {
    miniProgram = await connectOpenedAutomator({
      projectPath,
      timeout: 3_000,
    })
  }
  catch {
    return null
  }

  miniProgram.disconnect()
  logger.info(formatReuseOpenedWechatIdePrompt())

  const action = await waitForRetryKeypress()
  if (action !== 'retry') {
    return {
      reopened: false,
      reused: true,
    } as const
  }

  logger.info(colors.bold(colors.green('正在关闭当前已打开项目，并重新拉起微信开发者工具...')))
  const closed = await closeIde()
  if (!closed) {
    logger.warn('关闭当前微信开发者工具失败，仍继续尝试重新打开目标项目。')
  }

  await openWechatIdeByAutomator(projectPath)
  return {
    reopened: true,
    reused: false,
  } as const
}

export async function openIde(platform?: MpPlatform, projectPath?: string, options: OpenIdeOptions = {}) {
  if (platform === 'weapp' && projectPath && options.trustProject !== false) {
    try {
      const reuseResult = await tryReuseOpenedWechatIde(projectPath)
      if (reuseResult?.reused || reuseResult?.reopened) {
        return
      }
      await openWechatIdeByAutomator(projectPath)
      return
    }
    catch (error) {
      logger.warn('通过 automator 启动微信开发者工具并自动信任项目失败，回退到普通 open 流程。')
      logger.error(error)
    }
  }

  const argv = ['open', '-p']
  if (projectPath) {
    argv.push(projectPath)
  }
  if (platform && shouldPassPlatformArgToIdeOpen(platform)) {
    argv.push('--platform', platform)
  }

  await runWechatIdeOpenWithRetry(argv)
}

/**
 * @description 解析 IDE 相关命令所需的平台、项目目录与配置上下文。
 */
export async function resolveIdeCommandContext(options: ResolveIdeCommandOptions): Promise<ResolvedIdeCommandContext> {
  const cwd = options.cwd ?? process.cwd()
  let platform = options.platform
  let projectPath = options.projectPath

  if (!platform || !projectPath) {
    try {
      const ctx = await createCompilerContext({
        cwd,
        mode: options.mode ?? 'development',
        configFile: options.configFile,
        inlineConfig: createInlineConfig(platform),
        cliPlatform: options.cliPlatform,
      })
      platform ??= ctx.configService.platform
      if (!projectPath) {
        projectPath = resolveIdeProjectRoot(ctx.configService.mpDistRoot, ctx.configService.cwd)
      }
      return {
        platform,
        projectPath,
        weappViteConfig: ctx.configService.weappViteConfig,
        mpDistRoot: ctx.configService.mpDistRoot,
      }
    }
    catch {
      // 忽略配置加载失败，回退到静态推导
    }
  }

  if (!projectPath) {
    const defaultProjectRoot = getDefaultIdeProjectRoot(platform)
    if (defaultProjectRoot) {
      projectPath = resolveIdeProjectRoot(defaultProjectRoot, cwd)
    }
  }

  return {
    platform,
    projectPath,
  }
}
