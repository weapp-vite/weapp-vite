import path from 'node:path'
import process from 'node:process'
import { withMiniProgram } from './automator-session'
import { resetWechatIdeFileUtilsByHttp } from './http'
import { runWechatCliCommand } from './run-wechat-cli'

export interface LoginWechatIdeOptions {
  qrFormat?: 'base64' | 'image' | 'terminal'
  qrOutput?: string
  qrSize?: string
  resultOutput?: string
}

export interface OpenWechatIdeOptions {
  appid?: string
  extAppid?: string
  platform?: string
  projectPath?: string
  trustProject?: boolean
}

export interface BuildWechatIdeNpmOptions {
  compileType?: string
  projectPath?: string
}

export interface PreviewWechatIdeOptions {
  appid?: string
  compileCondition?: string
  extAppid?: string
  infoOutput?: string
  projectPath?: string
  qrFormat?: 'base64' | 'image' | 'terminal'
  qrOutput?: string
  qrSize?: string
}

export interface AutoPreviewWechatIdeOptions {
  appid?: string
  compileCondition?: string
  extAppid?: string
  infoOutput?: string
  projectPath?: string
}

export interface UploadWechatIdeOptions {
  appid?: string
  desc: string
  extAppid?: string
  infoOutput?: string
  projectPath?: string
  version: string
}

export interface AutoWechatIdeOptions {
  account?: string
  appid?: string
  extAppid?: string
  port?: string
  projectPath?: string
  testTicket?: string
  ticket?: string
  trustProject?: boolean
}

export interface AutoReplayWechatIdeOptions {
  account?: string
  appid?: string
  extAppid?: string
  port?: string
  projectPath?: string
  replayAll?: boolean
  replayConfigPath?: string
  testTicket?: string
  ticket?: string
  trustProject?: boolean
}

export interface OpenWechatIdeOtherProjectOptions {
  projectPath?: string
}

export interface ClearWechatIdeCacheOptions {
  clean: 'all' | 'auth' | 'compile' | 'file' | 'network' | 'session' | 'storage'
}

export interface ResetWechatIdeFileUtilsOptions {
  projectPath: string
}

export interface WechatIdeAutomatorSessionOptions {
  preferOpenedSession?: boolean
  projectPath: string
  sharedSession?: boolean
  timeout?: number
}

export interface CompileWechatIdeByAutomatorOptions extends WechatIdeAutomatorSessionOptions {
  force?: boolean
}

export interface ClearWechatIdeCacheByAutomatorOptions extends WechatIdeAutomatorSessionOptions {
  clean: 'all' | 'auth' | 'compile' | 'file' | 'network' | 'session' | 'storage'
}

export interface SetWechatIdeTicketOptions extends WechatIdeAutomatorSessionOptions {
  ticket: string
}

export interface BuildWechatIdeApkOptions {
  desc?: string
  isUploadResourceBundle?: boolean
  keyAlias: string
  keyPass: string
  keyStore: string
  output: string
  resourceBundleDesc?: string
  resourceBundleVersion?: string
  storePass: string
  useAab?: boolean
}

export interface BuildWechatIdeIpaOptions {
  certificateName?: string
  isDistribute: boolean
  isRemoteBuild?: boolean
  isUploadBeta?: boolean
  isUploadResourceBundle?: boolean
  output: string
  p12Password?: string
  p12Path?: string
  profilePath?: string
  resourceBundleDesc?: string
  resourceBundleVersion?: string
  tpnsProfilePath?: string
  versionCode?: number
  versionDesc?: string
  versionName?: string
}

function appendProjectLocatorArgv(argv: string[], options: {
  appid?: string
  extAppid?: string
  projectPath?: string
}) {
  if (options.projectPath) {
    argv.push('--project', path.resolve(options.projectPath))
  }
  if (options.appid) {
    argv.push('--appid', options.appid)
  }
  if (options.extAppid) {
    argv.push('--ext-appid', options.extAppid)
  }
}

/**
 * @description 调用微信开发者工具 open 命令。
 */
export async function openWechatIde(options: OpenWechatIdeOptions = {}) {
  const argv = ['open']

  appendProjectLocatorArgv(argv, options)

  if (options.platform) {
    argv.push('--platform', options.platform)
  }
  if (options.trustProject) {
    argv.push('--trust-project')
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 login 命令。
 */
export async function loginWechatIde(options: LoginWechatIdeOptions = {}) {
  const argv = ['login']

  if (options.qrFormat) {
    argv.push('--qr-format', options.qrFormat)
  }
  if (options.qrOutput) {
    argv.push('--qr-output', path.resolve(options.qrOutput))
  }
  if (options.qrSize) {
    argv.push('--qr-size', options.qrSize)
  }
  if (options.resultOutput) {
    argv.push('--result-output', path.resolve(options.resultOutput))
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 islogin 命令。
 */
export async function isWechatIdeLoggedIn() {
  await runWechatCliCommand(['islogin'])
}

/**
 * @description 调用微信开发者工具 build-npm 命令。
 */
export async function buildWechatIdeNpm(options: BuildWechatIdeNpmOptions = {}) {
  const argv = ['build-npm', '--project', path.resolve(options.projectPath ?? process.cwd())]

  if (options.compileType) {
    argv.push('--compile-type', options.compileType)
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 preview 命令。
 */
export async function previewWechatIde(options: PreviewWechatIdeOptions = {}) {
  const argv = ['preview']

  appendProjectLocatorArgv(argv, options)

  if (options.qrFormat) {
    argv.push('--qr-format', options.qrFormat)
  }
  if (options.qrOutput) {
    argv.push('--qr-output', path.resolve(options.qrOutput))
  }
  if (options.qrSize) {
    argv.push('--qr-size', options.qrSize)
  }
  if (options.infoOutput) {
    argv.push('--info-output', path.resolve(options.infoOutput))
  }
  if (options.compileCondition) {
    argv.push('--compile-condition', options.compileCondition)
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 auto-preview 命令。
 */
export async function autoPreviewWechatIde(options: AutoPreviewWechatIdeOptions = {}) {
  const argv = ['auto-preview']

  appendProjectLocatorArgv(argv, options)

  if (options.infoOutput) {
    argv.push('--info-output', path.resolve(options.infoOutput))
  }
  if (options.compileCondition) {
    argv.push('--compile-condition', options.compileCondition)
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 auto 命令。
 */
export async function autoWechatIde(options: AutoWechatIdeOptions = {}) {
  const argv = ['auto']

  appendProjectLocatorArgv(argv, options)

  if (options.port) {
    argv.push('--auto-port', options.port)
  }
  if (options.account) {
    argv.push('--auto-account', options.account)
  }
  if (options.testTicket) {
    argv.push('--test-ticket', options.testTicket)
  }
  if (options.ticket) {
    argv.push('--ticket', options.ticket)
  }
  if (options.trustProject) {
    argv.push('--trust-project')
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 auto-replay 命令。
 */
export async function autoReplayWechatIde(options: AutoReplayWechatIdeOptions = {}) {
  const argv = ['auto-replay']

  appendProjectLocatorArgv(argv, options)

  if (options.port) {
    argv.push('--auto-port', options.port)
  }
  if (options.account) {
    argv.push('--auto-account', options.account)
  }
  if (options.replayAll) {
    argv.push('--replay-all')
  }
  if (options.replayConfigPath) {
    argv.push('--replay-config-path', path.resolve(options.replayConfigPath))
  }
  if (options.testTicket) {
    argv.push('--test-ticket', options.testTicket)
  }
  if (options.ticket) {
    argv.push('--ticket', options.ticket)
  }
  if (options.trustProject) {
    argv.push('--trust-project')
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 upload 命令。
 */
export async function uploadWechatIde(options: UploadWechatIdeOptions) {
  const argv = ['upload']

  appendProjectLocatorArgv(argv, options)
  argv.push('--version', options.version, '--desc', options.desc)

  if (options.infoOutput) {
    argv.push('--info-output', path.resolve(options.infoOutput))
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 close 命令。
 */
export async function closeWechatIdeProject() {
  await runWechatCliCommand(['close'])
}

/**
 * @description 调用微信开发者工具 quit 命令。
 */
export async function quitWechatIde() {
  await runWechatCliCommand(['quit'])
}

/**
 * @description 调用微信开发者工具 cache 命令。
 */
export async function clearWechatIdeCache(options: ClearWechatIdeCacheOptions) {
  await runWechatCliCommand(['cache', '--clean', options.clean])
}

/**
 * @description 调用微信开发者工具 open-other 命令。
 */
export async function openWechatIdeOtherProject(_options: OpenWechatIdeOtherProjectOptions = {}) {
  await runWechatCliCommand(['open-other'])
}

/**
 * @description 通过微信开发者工具 HTTP 服务端口重置指定项目的 fileutils 状态。
 */
export async function resetWechatIdeFileUtils(options: ResetWechatIdeFileUtilsOptions) {
  await resetWechatIdeFileUtilsByHttp(path.resolve(options.projectPath))
}

function createAutomatorSessionOptions(options: WechatIdeAutomatorSessionOptions) {
  return {
    preferOpenedSession: options.preferOpenedSession ?? true,
    projectPath: path.resolve(options.projectPath),
    sharedSession: options.sharedSession ?? true,
    timeout: options.timeout,
  }
}

/**
 * @description 通过已打开或新建的 automator 会话获取开发者工具基础信息。
 */
export async function getWechatIdeToolInfo(options: WechatIdeAutomatorSessionOptions) {
  return await withMiniProgram(createAutomatorSessionOptions(options), async (miniProgram) => {
    return await miniProgram.toolInfo()
  })
}

/**
 * @description 通过已打开或新建的 automator 会话执行项目编译。
 */
export async function compileWechatIdeByAutomator(options: CompileWechatIdeByAutomatorOptions) {
  return await withMiniProgram(createAutomatorSessionOptions(options), async (miniProgram) => {
    return await miniProgram.compile({
      force: options.force,
    })
  })
}

/**
 * @description 通过已打开或新建的 automator 会话清理开发者工具缓存。
 */
export async function clearWechatIdeCacheByAutomator(options: ClearWechatIdeCacheByAutomatorOptions) {
  return await withMiniProgram(createAutomatorSessionOptions(options), async (miniProgram) => {
    return await miniProgram.clearCache({
      clean: options.clean,
    })
  })
}

/**
 * @description 通过已打开或新建的 automator 会话获取当前 ticket。
 */
export async function getWechatIdeTicket(options: WechatIdeAutomatorSessionOptions) {
  return await withMiniProgram(createAutomatorSessionOptions(options), async (miniProgram) => {
    return await miniProgram.getTicket()
  })
}

/**
 * @description 通过已打开或新建的 automator 会话设置 ticket。
 */
export async function setWechatIdeTicket(options: SetWechatIdeTicketOptions) {
  return await withMiniProgram(createAutomatorSessionOptions(options), async (miniProgram) => {
    await miniProgram.setTicket(options.ticket)
  })
}

/**
 * @description 通过已打开或新建的 automator 会话刷新 ticket。
 */
export async function refreshWechatIdeTicket(options: WechatIdeAutomatorSessionOptions) {
  return await withMiniProgram(createAutomatorSessionOptions(options), async (miniProgram) => {
    await miniProgram.refreshTicket()
  })
}

/**
 * @description 通过已打开或新建的 automator 会话获取测试账号列表。
 */
export async function getWechatIdeTestAccounts(options: WechatIdeAutomatorSessionOptions) {
  return await withMiniProgram(createAutomatorSessionOptions(options), async (miniProgram) => {
    return await miniProgram.testAccounts()
  })
}

/**
 * @description 调用微信开发者工具 build-apk 命令。
 */
export async function buildWechatIdeApk(options: BuildWechatIdeApkOptions) {
  const argv = [
    'build-apk',
    '--key-store',
    path.resolve(options.keyStore),
    '--key-alias',
    options.keyAlias,
    '--key-pass',
    options.keyPass,
    '--store-pass',
    options.storePass,
    '--output',
    path.resolve(options.output),
  ]

  if (options.useAab !== undefined) {
    argv.push('--use-aab', String(options.useAab))
  }
  if (options.desc) {
    argv.push('--desc', options.desc)
  }
  if (options.isUploadResourceBundle) {
    argv.push('--isUploadResourceBundle')
  }
  if (options.resourceBundleVersion) {
    argv.push('--resourceBundleVersion', options.resourceBundleVersion)
  }
  if (options.resourceBundleDesc) {
    argv.push('--resourceBundleDesc', options.resourceBundleDesc)
  }

  await runWechatCliCommand(argv)
}

/**
 * @description 调用微信开发者工具 build-ipa 命令。
 */
export async function buildWechatIdeIpa(options: BuildWechatIdeIpaOptions) {
  const argv = [
    'build-ipa',
    '--output',
    path.resolve(options.output),
    '--isDistribute',
    String(options.isDistribute),
  ]

  if (options.isRemoteBuild !== undefined) {
    argv.push('--isRemoteBuild', String(options.isRemoteBuild))
  }
  if (options.profilePath) {
    argv.push('--profilePath', path.resolve(options.profilePath))
  }
  if (options.certificateName) {
    argv.push('--certificateName', options.certificateName)
  }
  if (options.p12Path) {
    argv.push('--p12Path', path.resolve(options.p12Path))
  }
  if (options.p12Password) {
    argv.push('--p12Password', options.p12Password)
  }
  if (options.tpnsProfilePath) {
    argv.push('--tpnsProfilePath', path.resolve(options.tpnsProfilePath))
  }
  if (options.isUploadBeta !== undefined) {
    argv.push('--isUploadBeta', String(options.isUploadBeta))
  }
  if (options.isUploadResourceBundle) {
    argv.push('--isUploadResourceBundle')
  }
  if (options.resourceBundleVersion) {
    argv.push('--resourceBundleVersion', options.resourceBundleVersion)
  }
  if (options.resourceBundleDesc) {
    argv.push('--resourceBundleDesc', options.resourceBundleDesc)
  }
  if (options.versionName) {
    argv.push('--versionName', options.versionName)
  }
  if (options.versionCode !== undefined) {
    argv.push('--versionCode', String(options.versionCode))
  }
  if (options.versionDesc) {
    argv.push('--versionDesc', options.versionDesc)
  }

  await runWechatCliCommand(argv)
}
