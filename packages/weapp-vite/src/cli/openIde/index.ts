import type { MpPlatform } from '../../types'
import process from 'node:process'
import path from 'pathe'
import {
  bootstrapWechatDevtoolsSettings,
  formatAutomatorLoginError,
  isAutomatorLoginError,
} from 'weapp-ide-cli'
import { createCompilerContext } from '../../createContext'
import logger, { colors } from '../../logger'
import {
  getDefaultIdeProjectRoot,
  shouldPassPlatformArgToIdeOpen,
} from '../../platform'
import { createInlineConfig } from '../runtime'
import { closeIde as closeWechatIde } from './close'
import { executeWechatIdeCliCommand } from './execute'
import {
  openWechatIdeByAutomator,
  reopenOpenedWechatIde,
  tryReuseOpenedWechatIde,
} from './reuse'

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
  reuseOpenedProject?: boolean
}

function shouldLogAutomatorFallbackError() {
  const flag = process.env.WEAPP_VITE_DEBUG_AUTOMATOR_OPEN
  return flag === '1' || flag === 'true'
}

/**
 * @description 执行 IDE 打开流程，并在登录失效时允许按键重试。
 */
async function runWechatIdeOpenWithRetry(argv: string[]) {
  await executeWechatIdeCliCommand(argv, {
    cancelLevel: 'warn',
    onNonLoginError: error => logger.error(error),
    onRetry: () => {
      logger.info(colors.bold(colors.green('正在重试连接微信开发者工具...')))
    },
  })
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
  return await closeWechatIde()
}

async function tryOpenWechatIdeByAutomator(projectPath: string, options: OpenIdeOptions) {
  if (options.reuseOpenedProject === false) {
    const reopened = await reopenOpenedWechatIde(projectPath, closeIde)
    if (reopened) {
      return true
    }
  }

  const reuseResult = await tryReuseOpenedWechatIde(projectPath, closeIde)
  if (reuseResult?.reused || reuseResult?.reopened) {
    return true
  }

  await openWechatIdeByAutomator(projectPath)
  return true
}

function createIdeOpenArgv(platform?: MpPlatform, projectPath?: string, options: OpenIdeOptions = {}) {
  const argv = ['open', '-p']
  if (projectPath) {
    argv.push(projectPath)
  }
  if (platform === 'weapp' && options.trustProject !== false) {
    argv.push('--trust-project')
  }
  if (platform && shouldPassPlatformArgToIdeOpen(platform)) {
    argv.push('--platform', platform)
  }
  return argv
}

export async function openIde(platform?: MpPlatform, projectPath?: string, options: OpenIdeOptions = {}) {
  let bootstrapResult: Awaited<ReturnType<typeof bootstrapWechatDevtoolsSettings>> | undefined

  if (platform === 'weapp' && projectPath) {
    try {
      bootstrapResult = await bootstrapWechatDevtoolsSettings({
        projectPath,
        trustProject: options.trustProject,
      })
    }
    catch (error) {
      logger.warn('检测微信开发者工具服务端口或写入项目信任状态失败，继续执行 open 流程。')
      logger.error(error)
    }
  }

  if (platform === 'weapp' && projectPath && bootstrapResult?.servicePortEnabled === false) {
    logger.warn('检测到微信开发者工具服务端口当前处于关闭状态，已保留用户设置并回退到普通 open 流程。')
  }

  if (platform === 'weapp' && projectPath && options.trustProject !== false && bootstrapResult?.servicePortEnabled !== false) {
    try {
      const opened = await tryOpenWechatIdeByAutomator(projectPath, options)
      if (opened) {
        return
      }
    }
    catch (error) {
      if (isAutomatorLoginError(error)) {
        logger.error('检测到微信开发者工具登录状态失效，请先登录后重试。')
        logger.warn(formatAutomatorLoginError(error))
      }
      logger.warn('通过 automator 启动微信开发者工具并自动信任项目失败，回退到普通 open 流程。')
      if (shouldLogAutomatorFallbackError()) {
        logger.error(error)
      }
    }
  }

  await runWechatIdeOpenWithRetry(createIdeOpenArgv(platform, projectPath, options))
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
