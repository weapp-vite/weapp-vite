import { dispatchWechatCliCommand, isWeappIdeTopLevelCommand } from 'weapp-ide-cli'
import logger from '../logger'
import { executeWechatIdeCliCommand } from './openIde/execute'

const WEAPP_VITE_NATIVE_COMMANDS = new Set([
  'dev',
  'serve',
  'build',
  'upload',
  'preview',
  'close',
  'analyze',
  'alipay',
  'init',
  'open',
  'npm',
  'build:npm',
  'build-npm',
  'generate',
  'g',
  'mcp',
  'accept',
])

const LEGACY_UPLOAD_OPTIONS: Record<string, true> = {
  '--version': true,
  '-v': true,
  '--project': true,
  '--appid': true,
  '--ext-appid': true,
  '--info-output': true,
  '-i': true,
}
const SDK_UPLOAD_OPTIONS: Record<string, true> = {
  '--platform': true,
  '--uv': true,
  '--bump': true,
  '--git-desc': true,
  '--dry-run': true,
}
const UPLOAD_VALUE_OPTIONS: Record<string, true> = {
  ...LEGACY_UPLOAD_OPTIONS,
  '-p': true,
  '--desc': true,
  '-d': true,
  '--platform': true,
  '--uv': true,
  '--bump': true,
  '--project-config': true,
  '--port': true,
  '--lang': true,
  '-c': true,
  '--config': true,
  '--base': true,
  '-l': true,
  '--logLevel': true,
  '-f': true,
  '--filter': true,
  '-m': true,
  '--mode': true,
}

/**
 * @description 仅按显式参数区分上传方言，不根据 -p 的值或文件系统猜测后端。
 */
function isLegacyUploadInvocation(argv: readonly string[]) {
  let legacyOption: string | undefined
  let sdkOption: string | undefined

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--') {
      break
    }
    const equalsIndex = token.indexOf('=')
    const option = equalsIndex === -1 ? token : token.slice(0, equalsIndex)
    if (LEGACY_UPLOAD_OPTIONS[option] === true) {
      legacyOption = option
    }
    if (SDK_UPLOAD_OPTIONS[option.startsWith('--no-') ? `--${option.slice(5)}` : option] === true) {
      sdkOption = option
    }
    if (legacyOption && sdkOption) {
      throw new Error(`不能混用微信 IDE 上传参数 ${legacyOption} 与 SDK 上传参数 ${sdkOption}；请使用 wv ide upload 保留 IDE 行为，或使用 wv build --upload 迁移到 SDK。`)
    }
    // 必填值遵循 readOptionValue，- 前缀及 -- 都是数据；可选的 --debug 不会吞掉后续选项。
    if (equalsIndex === -1 && UPLOAD_VALUE_OPTIONS[option] === true) {
      index += 1
    }
  }
  return legacyOption !== undefined
}

function warnLegacyUpload() {
  logger.warn(
    '顶层微信 IDE 上传语法已弃用，将在未来版本移除。'
    + '请迁移到 wv build --upload -p weapp --uv <version> --desc <description>（SDK 流程需要源码目录与上传凭据，并非 IDE 命令的等价替换）；'
    + '或使用 wv ide upload ... 保留现有 IDE 行为。',
  )
}

/**
 * @description 保留旧版上传方言；其余未命中自身命令的调用回退到 weapp-ide-cli。
 */
export async function tryRunIdeCommand(argv: string[]) {
  const command = argv[0]
  if (!command) {
    return false
  }

  if (command === 'ide') {
    if (argv[1] === 'logs' || argv[1] === 'doctor' || argv[1] === '--help' || argv[1] === '-h') {
      return false
    }
    const handledByHelper = await dispatchWechatCliCommand(argv.slice(1))
    if (!handledByHelper) {
      await executeWechatIdeCliCommand(argv.slice(1))
    }
    return true
  }

  if (command.startsWith('-')) {
    return false
  }

  if (command === 'help') {
    const target = argv[1]
    if (!target || (target !== 'upload' && WEAPP_VITE_NATIVE_COMMANDS.has(target)) || !isWeappIdeTopLevelCommand(target)) {
      return false
    }
    if (target === 'upload') {
      warnLegacyUpload()
    }
    await executeWechatIdeCliCommand(argv)
    return true
  }

  const legacyUpload = command === 'upload' && isLegacyUploadInvocation(argv)
  if ((!legacyUpload && WEAPP_VITE_NATIVE_COMMANDS.has(command)) || !isWeappIdeTopLevelCommand(command)) {
    return false
  }
  if (legacyUpload) {
    warnLegacyUpload()
  }

  const handledByHelper = await dispatchWechatCliCommand(argv)
  if (!handledByHelper) {
    await executeWechatIdeCliCommand(argv)
  }
  return true
}
