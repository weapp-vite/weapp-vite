import { i18nText } from '../i18n'
import { readBooleanOption, readOptionValue } from './automator-argv'

const CACHE_CLEAN_TYPES = [
  'storage',
  'file',
  'compile',
  'auth',
  'network',
  'session',
  'all',
] as const

const QR_FORMAT_TYPES = ['terminal', 'image', 'base64'] as const

function isNonEmptyText(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function validatePortOption(argv: readonly string[]) {
  const port = readOptionValue(argv, '--port')
  if (!port) {
    return
  }

  const parsed = Number.parseInt(port, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      i18nText(
        `无效的 --port 值: ${port}（必须为正整数）`,
        `Invalid --port value: ${port} (must be a positive integer)`,
      ),
    )
  }
}

function validateProjectLocator(command: string, argv: readonly string[]) {
  const projectPath = readOptionValue(argv, '--project', '-p')
  const appid = readOptionValue(argv, '--appid')

  if (isNonEmptyText(projectPath) || isNonEmptyText(appid)) {
    return
  }

  throw new Error(
    i18nText(
      `${command} 命令需要提供 --project 或 --appid`,
      `${command} command requires --project or --appid`,
    ),
  )
}

function validateExtAppidDependency(argv: readonly string[]) {
  const extAppid = readOptionValue(argv, '--ext-appid')
  if (!isNonEmptyText(extAppid)) {
    return
  }

  const projectPath = readOptionValue(argv, '--project', '-p')
  if (isNonEmptyText(projectPath)) {
    return
  }

  const appid = readOptionValue(argv, '--appid')
  if (isNonEmptyText(appid)) {
    return
  }

  throw new Error(
    i18nText(
      '--ext-appid 需要和 --appid 一起使用（当未提供 --project 时）',
      '--ext-appid requires --appid when --project is not provided',
    ),
  )
}

/**
 * @description 在调用官方微信 CLI 前做轻量参数校验。
 */
export function validateWechatCliCommandArgs(argv: readonly string[]) {
  const command = argv[0]
  if (!command) {
    return
  }

  validatePortOption(argv)
  validateExtAppidDependency(argv)

  if (command === 'upload') {
    const version = readOptionValue(argv, '--version', '-v')
    const desc = readOptionValue(argv, '--desc', '-d')

    if (!isNonEmptyText(version) || !isNonEmptyText(desc)) {
      throw new Error(
        i18nText(
          'upload 命令缺少必填参数：--version/-v 和 --desc/-d',
          'upload command requires both --version/-v and --desc/-d',
        ),
      )
    }
  }

  if (command === 'preview') {
    validateProjectLocator(command, argv)

    const qrFormat = readOptionValue(argv, '--qr-format', '-f')
    if (!qrFormat) {
      return
    }

    if (!QR_FORMAT_TYPES.includes(qrFormat.toLowerCase() as (typeof QR_FORMAT_TYPES)[number])) {
      throw new Error(
        i18nText(
          `preview 命令的二维码格式无效: ${qrFormat}（仅支持 ${QR_FORMAT_TYPES.join('/')}）`,
          `Invalid preview qr format: ${qrFormat} (supported: ${QR_FORMAT_TYPES.join('/')})`,
        ),
      )
    }
  }

  if (command === 'login') {
    const qrFormat = readOptionValue(argv, '--qr-format', '-f')

    if (qrFormat && !QR_FORMAT_TYPES.includes(qrFormat.toLowerCase() as (typeof QR_FORMAT_TYPES)[number])) {
      throw new Error(
        i18nText(
          `login 命令的二维码格式无效: ${qrFormat}（仅支持 ${QR_FORMAT_TYPES.join('/')}）`,
          `Invalid login qr format: ${qrFormat} (supported: ${QR_FORMAT_TYPES.join('/')})`,
        ),
      )
    }
  }

  if (command === 'cache') {
    const cleanType = readOptionValue(argv, '--clean', '-c')

    if (!isNonEmptyText(cleanType)) {
      throw new Error(
        i18nText(
          'cache 命令缺少必填参数：--clean/-c',
          'cache command requires --clean/-c',
        ),
      )
    }

    if (
      !CACHE_CLEAN_TYPES.includes(
        cleanType as (typeof CACHE_CLEAN_TYPES)[number],
      )
    ) {
      throw new Error(
        i18nText(
          `cache 命令的清理类型无效: ${cleanType}（仅支持 ${CACHE_CLEAN_TYPES.join('/')}）`,
          `Invalid cache clean type: ${cleanType} (supported: ${CACHE_CLEAN_TYPES.join('/')})`,
        ),
      )
    }
  }

  if (
    command === 'upload'
    || command === 'auto'
    || command === 'auto-replay'
    || command === 'auto-preview'
    || command === 'reset-fileutils'
  ) {
    validateProjectLocator(command, argv)
  }

  if (command === 'build-npm') {
    const compileType = readOptionValue(argv, '--compile-type')
    if (compileType !== undefined && !isNonEmptyText(compileType)) {
      throw new Error(
        i18nText(
          'build-npm 命令的 --compile-type 不能为空字符串',
          'build-npm command requires a non-empty --compile-type value',
        ),
      )
    }
  }

  if (command === 'build-apk') {
    const output = readOptionValue(argv, '--output', '-o')
    const keyStore = readOptionValue(argv, '--key-store', '--keyStore', '-ks')
    const keyAlias = readOptionValue(argv, '--key-alias', '--keyAlias', '-ka')
    const keyPass = readOptionValue(argv, '--key-pass', '--keyPass', '-kp')
    const storePass = readOptionValue(argv, '--store-pass', '--storePass', '-sp')

    if (
      !isNonEmptyText(output)
      || !isNonEmptyText(keyStore)
      || !isNonEmptyText(keyAlias)
      || !isNonEmptyText(keyPass)
      || !isNonEmptyText(storePass)
    ) {
      throw new Error(
        i18nText(
          'build-apk 命令缺少必填参数：--output/-o、--key-store/-ks、--key-alias/-ka、--key-pass/-kp、--store-pass/-sp',
          'build-apk command requires --output/-o, --key-store/-ks, --key-alias/-ka, --key-pass/-kp, and --store-pass/-sp',
        ),
      )
    }
  }

  if (command === 'build-ipa') {
    const output = readOptionValue(argv, '--output', '-o')
    const isDistribute = readBooleanOption(argv, '--isDistribute')

    if (!isNonEmptyText(output) || isDistribute === undefined) {
      throw new Error(
        i18nText(
          'build-ipa 命令缺少必填参数：--output/-o 和 --isDistribute',
          'build-ipa command requires both --output/-o and --isDistribute',
        ),
      )
    }
  }
}
