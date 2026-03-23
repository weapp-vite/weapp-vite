import type { MpPlatform } from '../types'
import process from 'node:process'
import path from 'pathe'
import {
  formatRetryHotkeyPrompt,
  formatWechatIdeLoginRequiredError,
  isWechatIdeLoginRequiredError,
  parse,
  waitForRetryKeypress,
} from 'weapp-ide-cli'
import { createCompilerContext } from '../createContext'
import logger, { colors } from '../logger'
import { createInlineConfig } from './runtime'

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

export async function openIde(platform?: MpPlatform, projectPath?: string) {
  const argv = ['open', '-p']
  if (projectPath) {
    argv.push(projectPath)
  }
  if (platform === 'alipay') {
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

  if (!projectPath && platform === 'alipay') {
    projectPath = resolveIdeProjectRoot('dist/alipay/dist', cwd)
  }

  return {
    platform,
    projectPath,
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
