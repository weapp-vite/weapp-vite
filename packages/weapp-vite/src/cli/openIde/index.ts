import type { MpPlatform } from '../../types'
import process from 'node:process'
import path from 'pathe'
import {
  bootstrapWechatDevtoolsSettings,
  formatAutomatorLoginError,
  isAutomatorLoginError,
  isWechatIdeEngineBuildEndpointMissingError,
  launchAutomator,
  resolveProjectAutomatorPort,
} from 'weapp-ide-cli'
import { createCompilerContext } from '../../createContext'
import logger, { colors } from '../../logger'
import {
  getDefaultIdeProjectRoot,
  shouldPassPlatformArgToIdeOpen,
} from '../../platform'
import { createInlineConfig } from '../runtime'
import { closeIde as closeWechatIde } from './close'
import {
  logWechatIdeRecoveryHint,
  logWechatIdeServicePortDisabledHint,
} from './diagnostics'
import { executeWechatIdeCliCommand, isWechatIdeLoginRequiredExitError } from './execute'
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
  cwd?: string
  platform?: MpPlatform
  projectPath?: string
  weappViteConfig?: Awaited<ReturnType<typeof createCompilerContext>>['configService']['weappViteConfig']
  mpDistRoot?: string
}

export interface OpenIdeOptions {
  trustProject?: boolean
  reuseOpenedProject?: boolean
  useAutomatorOpen?: boolean
  openRecovery?: boolean
  prepareAutomatorSession?: boolean
  skipPostOpenHealthCheck?: boolean
  loginRetry?: string
  loginRetryTimeout?: string
  nonInteractive?: boolean
}

type WechatIdeOpenHealthResult
  = | { ok: true }
    | {
      ok: false
      reason: 'automator-session-failed' | 'index-refresh-failed' | 'service-port-disabled'
      error?: unknown
    }

function shouldLogAutomatorFallbackError() {
  const flag = process.env.WEAPP_VITE_DEBUG_AUTOMATOR_OPEN
  return flag === '1' || flag === 'true'
}

const PREPARE_AUTOMATOR_SESSION_TIMEOUT = 8_000

function isWechatIdeOpenRecoveryDisabled(options: OpenIdeOptions) {
  if (options.openRecovery === false) {
    return true
  }
  const flag = process.env.WEAPP_VITE_DISABLE_IDE_OPEN_RECOVERY
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
    promptOpenIdeLogin: true,
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
      return 'reopened'
    }
  }

  const reuseResult = await tryReuseOpenedWechatIde(projectPath, closeIde, {
    promptReopen: options.reuseOpenedProject !== true,
  })
  if (reuseResult?.reused) {
    return 'reused'
  }
  if (reuseResult?.reopened) {
    return 'reopened'
  }

  await openWechatIdeByAutomator(projectPath)
  return 'opened'
}

/**
 * @description 打开后主动刷新微信开发者工具的项目索引，避免模拟器沿用过期 app 配置。
 */
function appendLoginRetryArgv(argv: string[], options: OpenIdeOptions) {
  if (options.nonInteractive) {
    argv.push('--non-interactive')
  }
  if (options.loginRetry) {
    argv.push('--login-retry', options.loginRetry)
  }
  if (options.loginRetryTimeout) {
    argv.push('--login-retry-timeout', options.loginRetryTimeout)
  }
  return argv
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
  if (options.nonInteractive) {
    argv.push('--non-interactive')
  }
  if (options.loginRetry) {
    argv.push('--login-retry', options.loginRetry)
  }
  if (options.loginRetryTimeout) {
    argv.push('--login-retry-timeout', options.loginRetryTimeout)
  }
  return argv
}

async function prepareOpenedWechatIdeAutomatorSession(projectPath: string, options: OpenIdeOptions): Promise<WechatIdeOpenHealthResult> {
  try {
    const miniProgram = await launchAutomator({
      persistAsDefaultSession: true,
      preserveProjectRoot: true,
      projectPath,
      port: resolveProjectAutomatorPort(projectPath),
      timeout: PREPARE_AUTOMATOR_SESSION_TIMEOUT,
      trustProject: options.trustProject !== false,
    }) as { disconnect?: () => void }
    miniProgram.disconnect?.()
    return { ok: true }
  }
  catch (error) {
    logger.warn('准备当前项目的微信开发者工具自动化会话失败，截图、MCP 或 IDE 联动命令首次运行时将重新连接。')
    logWechatIdeRecoveryHint({
      projectPath,
      reason: '无法建立当前项目的自动化会话，常见原因是 DevTools 服务端口未就绪、窗口停留在项目选择页，或存在残留 DevTools 会话。',
    })
    if (shouldLogAutomatorFallbackError()) {
      logger.error(error)
    }
    return {
      ok: false,
      reason: 'automator-session-failed',
      error,
    }
  }
}

async function stabilizeOpenedWechatIdeProject(
  projectPath: string,
  servicePortEnabled?: boolean,
  options: OpenIdeOptions = {},
): Promise<WechatIdeOpenHealthResult> {
  if (servicePortEnabled === false) {
    return {
      ok: false,
      reason: 'service-port-disabled',
    }
  }

  try {
    await executeWechatIdeCliCommand(appendLoginRetryArgv(['reset-fileutils', '-p', projectPath], options), {
      automatorMode: options.useAutomatorOpen === false ? 'skip' : 'prefer',
      httpMode: 'require',
      onNonLoginError: error => logger.error(error),
      preserveProjectRoot: options.useAutomatorOpen === false,
      projectPath,
    })
    try {
      await executeWechatIdeCliCommand(appendLoginRetryArgv(['engine', 'build', projectPath], options), {
        automatorMode: options.useAutomatorOpen === false ? 'skip' : 'prefer',
        engineBuildFallbackToCli: true,
        httpMode: 'prefer',
        onNonLoginError: error => logger.error(error),
        preserveProjectRoot: options.useAutomatorOpen === false,
        projectPath,
      })
    }
    catch (error) {
      if (!isWechatIdeEngineBuildEndpointMissingError(error)) {
        throw error
      }
      logger.warn('当前微信开发者工具不支持自动 engine build 刷新，已跳过该步骤；如模拟器显示旧状态，可在开发者工具内手动编译。')
    }
    if (options.useAutomatorOpen !== false) {
      try {
        await executeWechatIdeCliCommand(appendLoginRetryArgv(['compile'], options), {
          automatorMode: 'require',
          httpMode: 'skip',
          preserveProjectRoot: true,
          projectPath,
        })
      }
      catch (error) {
        if (shouldLogAutomatorFallbackError()) {
          logger.error(error)
        }
      }
    }
    return { ok: true }
  }
  catch (error) {
    if (isWechatIdeLoginRequiredExitError(error)) {
      throw error
    }

    logger.warn('刷新微信开发者工具项目索引失败，已保留当前打开状态；如模拟器仍显示旧状态，可手动刷新一次。')
    logWechatIdeRecoveryHint({
      projectPath,
      reason: '打开项目后的文件索引刷新失败，DevTools 可能仍在使用旧项目状态或内部服务未就绪。',
    })
    if (shouldLogAutomatorFallbackError()) {
      logger.error(error)
    }
    return {
      ok: false,
      reason: 'index-refresh-failed',
      error,
    }
  }
}

async function verifyOpenedWechatIdeProject(
  projectPath: string,
  servicePortEnabled: boolean | undefined,
  options: OpenIdeOptions,
): Promise<WechatIdeOpenHealthResult> {
  const stabilizeResult = await stabilizeOpenedWechatIdeProject(projectPath, servicePortEnabled, options)
  if (!stabilizeResult.ok) {
    return stabilizeResult
  }
  if (options.useAutomatorOpen === false && servicePortEnabled !== false) {
    return await prepareOpenedWechatIdeAutomatorSession(projectPath, options)
  }
  return stabilizeResult
}

function formatWechatIdeOpenHealthReason(result: Exclude<WechatIdeOpenHealthResult, { ok: true }>) {
  if (result.reason === 'index-refresh-failed') {
    return '项目索引刷新失败'
  }
  return '服务端口未开启'
}

async function recoverOpenedWechatIdeProject(
  platform: MpPlatform | undefined,
  projectPath: string,
  servicePortEnabled: boolean | undefined,
  options: OpenIdeOptions,
  failedResult: Exclude<WechatIdeOpenHealthResult, { ok: true }>,
) {
  if (failedResult.reason === 'service-port-disabled') {
    return failedResult
  }
  if (failedResult.reason === 'automator-session-failed') {
    logger.warn('已跳过微信开发者工具自动恢复；自动化会话预热失败不影响当前项目打开，截图、MCP 或 IDE 联动命令首次运行时会重新连接。')
    return failedResult
  }
  if (isWechatIdeOpenRecoveryDisabled(options)) {
    logger.warn('已跳过微信开发者工具自动恢复；请按上方提示手动关闭并重新打开目标项目。')
    return failedResult
  }

  logger.info(`检测到微信开发者工具打开后状态不稳定（${formatWechatIdeOpenHealthReason(failedResult)}），正在自动关闭并重新打开目标项目...`)
  const closed = await closeIde()
  if (!closed) {
    logger.warn('自动恢复时关闭当前微信开发者工具失败，仍继续尝试重新打开目标项目。')
  }
  await runWechatIdeOpenWithRetry(createIdeOpenArgv(platform, projectPath, options))
  const recoveredResult = await verifyOpenedWechatIdeProject(projectPath, servicePortEnabled, options)
  if (recoveredResult.ok) {
    logger.info('微信开发者工具已完成自动恢复。')
  }
  else {
    logger.warn('微信开发者工具自动恢复未完成；可设置 `WEAPP_VITE_DISABLE_IDE_OPEN_RECOVERY=1` 或传入 `--no-open-recovery` 跳过自动关闭重开，并按提示手动处理。')
  }
  return recoveredResult
}

async function verifyAndRecoverOpenedWechatIdeProject(
  platform: MpPlatform | undefined,
  projectPath: string,
  servicePortEnabled: boolean | undefined,
  options: OpenIdeOptions,
) {
  const healthResult = await verifyOpenedWechatIdeProject(projectPath, servicePortEnabled, options)
  if (!healthResult.ok) {
    await recoverOpenedWechatIdeProject(platform, projectPath, servicePortEnabled, options, healthResult)
  }
}

export async function openIde(platform?: MpPlatform, projectPath?: string, options: OpenIdeOptions = {}) {
  let bootstrapResult: Awaited<ReturnType<typeof bootstrapWechatDevtoolsSettings>> | undefined
  const useAutomatorOpen = options.useAutomatorOpen === true
  const normalizedOptions: OpenIdeOptions = {
    ...options,
    useAutomatorOpen,
  }

  if (platform === 'weapp' && projectPath) {
    try {
      bootstrapResult = await bootstrapWechatDevtoolsSettings({
        projectPath,
        trustProject: normalizedOptions.trustProject,
      })
    }
    catch (error) {
      logger.warn('检测微信开发者工具服务端口或写入项目信任状态失败，继续执行 open 流程。')
      logger.error(error)
    }
  }

  if (platform === 'weapp' && projectPath && bootstrapResult?.servicePortEnabled === false) {
    logWechatIdeServicePortDisabledHint(projectPath)
  }

  if (platform === 'weapp' && projectPath && normalizedOptions.trustProject !== false && bootstrapResult?.servicePortEnabled !== false && useAutomatorOpen) {
    try {
      const openResult = await tryOpenWechatIdeByAutomator(projectPath, normalizedOptions)
      if (openResult === 'reused') {
        return
      }
      if (openResult) {
        await verifyAndRecoverOpenedWechatIdeProject(platform, projectPath, bootstrapResult?.servicePortEnabled, normalizedOptions)
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
  else if (platform === 'weapp' && projectPath && normalizedOptions.reuseOpenedProject === false) {
    const closed = await closeIde()
    if (!closed) {
      logger.warn('关闭当前微信开发者工具失败，仍继续尝试打开目标项目。')
    }
  }

  await runWechatIdeOpenWithRetry(createIdeOpenArgv(platform, projectPath, normalizedOptions))
  if (platform === 'weapp' && projectPath && normalizedOptions.prepareAutomatorSession) {
    await prepareOpenedWechatIdeAutomatorSession(projectPath, normalizedOptions)
  }
  if (platform === 'weapp' && projectPath && !normalizedOptions.skipPostOpenHealthCheck) {
    await verifyAndRecoverOpenedWechatIdeProject(platform, projectPath, bootstrapResult?.servicePortEnabled, normalizedOptions)
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
        cwd: ctx.configService.cwd,
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
    cwd,
    platform,
    projectPath,
  }
}
