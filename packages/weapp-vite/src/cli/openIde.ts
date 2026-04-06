import type { MpPlatform } from '../types'
import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'
import path from 'pathe'
import {
  connectMiniProgram,
  formatRetryHotkeyPrompt,
  formatWechatIdeLoginRequiredError,
  getConfig,
  isWechatIdeLoginRequiredError,
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
  const { Launcher } = await import('@weapp-vite/miniprogram-automator')
  const launcher = new Launcher()
  const miniProgram = await launcher.launch({
    projectPath,
    trustProject: true,
  })
  miniProgram.disconnect()
}

/**
 * @description 若当前项目已在微信开发者工具中打开且自动化可连通，则直接复用现有会话，避免重复拉起 IDE。
 */
async function tryReuseOpenedWechatIde(projectPath: string) {
  try {
    const miniProgram = await connectMiniProgram({
      projectPath,
      timeout: 3_000,
    })
    miniProgram.disconnect()
    logger.info('目标项目已在微信开发者工具中打开，跳过重复打开。')
    return true
  }
  catch {
    return false
  }
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
      const shouldRetry = await waitForRetryKeypress()

      if (!shouldRetry) {
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

export async function openIde(platform?: MpPlatform, projectPath?: string, options: OpenIdeOptions = {}) {
  if (platform === 'weapp' && projectPath && options.trustProject !== false) {
    try {
      if (await tryReuseOpenedWechatIde(projectPath)) {
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
  if (shouldPassPlatformArgToIdeOpen(platform)) {
    argv.push('--platform', platform)
  }

  await runWechatIdeOpenWithRetry(argv)
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
