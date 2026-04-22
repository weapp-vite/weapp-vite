import path from 'node:path'
import process from 'node:process'
import { runWechatCliCommand } from './run-wechat-cli'

export interface LoginWechatIdeOptions {
  qrFormat?: 'base64' | 'image' | 'terminal'
  qrOutput?: string
  qrSize?: string
  resultOutput?: string
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

export interface OpenWechatIdeOtherProjectOptions {
  projectPath?: string
}

export interface ClearWechatIdeCacheOptions {
  clean: 'all' | 'auth' | 'compile' | 'file' | 'network' | 'session' | 'storage'
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
