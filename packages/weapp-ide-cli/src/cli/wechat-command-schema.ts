import { i18nText } from '../i18n'
import { readOptionValue } from './automator-argv'

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
    const version = readOptionValue(argv, '--version') || readOptionValue(argv, '-v')
    const desc = readOptionValue(argv, '--desc') || readOptionValue(argv, '-d')

    if (!isNonEmptyText(version) || !isNonEmptyText(desc)) {
      throw new Error(i18nText(
        'upload 命令缺少必填参数：--version/-v 和 --desc/-d',
        'upload command requires both --version/-v and --desc/-d',
      ))
    }
  }

  if (command === 'preview') {
    validateProjectLocator(command, argv)

    const qrFormat = readOptionValue(argv, '--qr-format') || readOptionValue(argv, '-f')
    if (!qrFormat) {
      return
    }

    if (!['terminal', 'image', 'base64'].includes(qrFormat.toLowerCase())) {
      throw new Error(i18nText(
        `preview 命令的二维码格式无效: ${qrFormat}（仅支持 terminal/image/base64）`,
        `Invalid preview qr format: ${qrFormat} (supported: terminal/image/base64)`,
      ))
    }
  }

  if (command === 'upload' || command === 'auto' || command === 'auto-preview') {
    validateProjectLocator(command, argv)
  }
}

function validatePortOption(argv: readonly string[]) {
  const port = readOptionValue(argv, '--port')
  if (!port) {
    return
  }

  const parsed = Number.parseInt(port, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(i18nText(
      `无效的 --port 值: ${port}（必须为正整数）`,
      `Invalid --port value: ${port} (must be a positive integer)`,
    ))
  }
}

function validateProjectLocator(command: string, argv: readonly string[]) {
  const projectPath = readOptionValue(argv, '--project')
  const appid = readOptionValue(argv, '--appid')

  if (isNonEmptyText(projectPath) || isNonEmptyText(appid)) {
    return
  }

  throw new Error(i18nText(
    `${command} 命令需要提供 --project 或 --appid`,
    `${command} command requires --project or --appid`,
  ))
}

function validateExtAppidDependency(argv: readonly string[]) {
  const extAppid = readOptionValue(argv, '--ext-appid')
  if (!isNonEmptyText(extAppid)) {
    return
  }

  const projectPath = readOptionValue(argv, '--project')
  if (isNonEmptyText(projectPath)) {
    return
  }

  const appid = readOptionValue(argv, '--appid')
  if (isNonEmptyText(appid)) {
    return
  }

  throw new Error(i18nText(
    '--ext-appid 需要和 --appid 一起使用（当未提供 --project 时）',
    '--ext-appid requires --appid when --project is not provided',
  ))
}

function isNonEmptyText(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}
