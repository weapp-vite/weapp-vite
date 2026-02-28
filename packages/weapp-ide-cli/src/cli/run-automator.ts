import type { ParsedAutomatorArgs } from './automator-argv'
import { i18nText } from '../i18n'
import logger from '../logger'
import { parseAutomatorArgs, readOptionValue } from './automator-argv'
import {
  audit,
  currentPage,
  input,
  navigateBack,
  navigateTo,
  pageData,
  pageStack,
  redirectTo,
  reLaunch,
  remote,
  scrollTo,
  switchTab,
  systemInfo,
  tap,
} from './commands'
import { runScreenshot } from './screenshot'

interface LocalizedText {
  zh: string
  en: string
}

interface CommandDefinition {
  description: LocalizedText
  usage: string
  options: Array<{ flag: string, description: LocalizedText }>
  allowedOptions: Set<string>
  handler: (ctx: CommandHandlerContext) => Promise<void>
}

interface CommandHandlerContext {
  argv: string[]
  args: ParsedAutomatorArgs
}

type CommandHandler = (ctx: CommandHandlerContext) => Promise<void>

const COMMON_ALLOWED_OPTIONS = new Set(['-p', '--project', '-t', '--timeout', '--json', '--lang', '-h', '--help'])

const COMMAND_DEFINITIONS: Record<string, CommandDefinition> = {
  'navigate': createDefinition({
    description: { zh: '跳转到页面（保留当前页面栈）', en: 'Navigate to a page (keep current page in stack)' },
    usage: 'weapp navigate <url> -p <project-path>',
    handler: async ({ args }) => {
      const url = requiredPositional(
        args.positionals[0],
        i18nText('navigate 命令缺少 URL 参数', 'URL is required for \'navigate\' command'),
      )
      await navigateTo({ ...args, url })
    },
  }),
  'redirect': createDefinition({
    description: { zh: '重定向到页面（关闭当前页面）', en: 'Redirect to a page (close current page)' },
    usage: 'weapp redirect <url> -p <project-path>',
    handler: async ({ args }) => {
      const url = requiredPositional(
        args.positionals[0],
        i18nText('redirect 命令缺少 URL 参数', 'URL is required for \'redirect\' command'),
      )
      await redirectTo({ ...args, url })
    },
  }),
  'back': createDefinition({
    description: { zh: '返回上一页', en: 'Navigate back to previous page' },
    usage: 'weapp back -p <project-path>',
    handler: async ({ args }) => {
      await navigateBack(args)
    },
  }),
  'relaunch': createDefinition({
    description: { zh: '重启到页面（关闭全部页面）', en: 'Re-launch to a page (close all pages)' },
    usage: 'weapp relaunch <url> -p <project-path>',
    handler: async ({ args }) => {
      const url = requiredPositional(
        args.positionals[0],
        i18nText('relaunch 命令缺少 URL 参数', 'URL is required for \'relaunch\' command'),
      )
      await reLaunch({ ...args, url })
    },
  }),
  'switch-tab': createDefinition({
    description: { zh: '切换到 tabBar 页面', en: 'Switch to a tab bar page' },
    usage: 'weapp switch-tab <url> -p <project-path>',
    handler: async ({ args }) => {
      const url = requiredPositional(
        args.positionals[0],
        i18nText('switch-tab 命令缺少 URL 参数', 'URL is required for \'switch-tab\' command'),
      )
      await switchTab({ ...args, url })
    },
  }),
  'page-stack': createDefinition({
    description: { zh: '获取页面栈', en: 'Get the page stack' },
    usage: 'weapp page-stack -p <project-path>',
    handler: async ({ args }) => {
      await pageStack(args)
    },
  }),
  'current-page': createDefinition({
    description: { zh: '获取当前页面信息', en: 'Get current page info' },
    usage: 'weapp current-page -p <project-path>',
    handler: async ({ args }) => {
      await currentPage(args)
    },
  }),
  'system-info': createDefinition({
    description: { zh: '获取系统信息', en: 'Get system info' },
    usage: 'weapp system-info -p <project-path>',
    handler: async ({ args }) => {
      await systemInfo(args)
    },
  }),
  'page-data': createDefinition({
    description: { zh: '获取页面数据', en: 'Get page data' },
    usage: 'weapp page-data [path] -p <project-path>',
    handler: async ({ args }) => {
      await pageData({ ...args, path: args.positionals[0] })
    },
  }),
  'tap': createDefinition({
    description: { zh: '点击元素', en: 'Tap an element' },
    usage: 'weapp tap <selector> -p <project-path>',
    handler: async ({ args }) => {
      const selector = requiredPositional(
        args.positionals[0],
        i18nText('tap 命令缺少 selector 参数', 'Selector is required for tap command'),
      )
      await tap({ ...args, selector })
    },
  }),
  'input': createDefinition({
    description: { zh: '向元素输入文本', en: 'Input text into an element' },
    usage: 'weapp input <selector> <value> -p <project-path>',
    handler: async ({ args }) => {
      const errorMessage = i18nText('input 命令缺少 selector 或 value 参数', 'Selector and value are required for input command')
      const selector = requiredPositional(args.positionals[0], errorMessage)
      const value = requiredPositional(args.positionals[1], errorMessage)
      await input({ ...args, selector, value })
    },
  }),
  'scroll': createDefinition({
    description: { zh: '滚动页面到指定位置', en: 'Scroll page to position' },
    usage: 'weapp scroll <scrollTop> -p <project-path>',
    handler: async ({ args }) => {
      const rawScrollTop = requiredPositional(
        args.positionals[0],
        i18nText('scroll 命令缺少滚动位置参数', 'Scroll position is required for scroll command'),
      )
      const scrollTop = Number.parseInt(rawScrollTop, 10)

      if (!Number.isFinite(scrollTop)) {
        throw new TypeError(i18nText(`无效的滚动位置: ${rawScrollTop}`, `Invalid scroll position: ${rawScrollTop}`))
      }

      await scrollTo({ ...args, scrollTop })
    },
  }),
  'audit': createDefinition({
    description: { zh: '执行体验评分审计', en: 'Run experience audit' },
    usage: 'weapp audit -p <project-path>',
    options: [
      { flag: '-o, --output <path>', description: { zh: '审计报告输出文件路径', en: 'Output file path for report' } },
    ],
    allowedOptions: ['-o', '--output'],
    handler: async ({ args, argv }) => {
      const outputPath = readOptionValue(argv, '-o') || readOptionValue(argv, '--output')
      await audit({ ...args, outputPath })
    },
  }),
  'remote': createDefinition({
    description: { zh: '开启/关闭远程调试', en: 'Enable/disable remote debugging' },
    usage: 'weapp remote -p <project-path>',
    options: [
      { flag: '--disable', description: { zh: '关闭远程调试', en: 'Disable remote debugging' } },
    ],
    allowedOptions: ['--disable'],
    handler: async ({ args, argv }) => {
      await remote({ ...args, enable: !argv.includes('--disable') })
    },
  }),
}

export const AUTOMATOR_COMMAND_NAMES = ['screenshot', ...Object.keys(COMMAND_DEFINITIONS)]
const AUTOMATOR_COMMANDS = new Set(AUTOMATOR_COMMAND_NAMES)

/**
 * @description 判断是否属于 automator 子命令。
 */
export function isAutomatorCommand(command: string | undefined) {
  return Boolean(command && AUTOMATOR_COMMANDS.has(command))
}

/**
 * @description 分发 automator 子命令。
 */
export async function runAutomatorCommand(command: string, argv: string[]) {
  if (command === 'screenshot') {
    await runScreenshot(argv)
    return
  }

  const definition = COMMAND_DEFINITIONS[command]
  if (!definition) {
    throw new Error(i18nText(`未知 automator 命令: ${command}`, `Unknown automator command: ${command}`))
  }

  if (argv.includes('-h') || argv.includes('--help')) {
    printCommandHelp(command)
    return
  }

  validateUnsupportedOptions(command, argv, definition.allowedOptions)

  const args = parseAutomatorArgs(argv)
  await definition.handler({ argv, args })
}

/**
 * @description 获取 automator 命令帮助文本。
 */
export function getAutomatorCommandHelp(command: string) {
  const definition = COMMAND_DEFINITIONS[command]
  if (!definition) {
    return undefined
  }

  const optionLines = [
    ...definition.options,
    { flag: '-p, --project <path>', description: { zh: '项目路径（默认：当前目录）', en: 'Project path (default: current directory)' } },
    { flag: '-t, --timeout <ms>', description: { zh: '连接超时时间（默认：30000）', en: 'Connection timeout (default: 30000)' } },
    { flag: '--json', description: { zh: '支持时以 JSON 输出', en: 'Output as JSON when supported' } },
    { flag: '--lang <lang>', description: { zh: '语言切换：zh | en（默认：zh）', en: 'Language: zh | en (default: zh)' } },
    { flag: '-h, --help', description: { zh: '显示命令帮助', en: 'Show command help' } },
  ]

  return [
    i18nText(definition.description.zh, definition.description.en),
    '',
    `Usage: ${definition.usage}`,
    '',
    i18nText('参数：', 'Options:'),
    ...optionLines.map(option => `  ${option.flag.padEnd(24)} ${i18nText(option.description.zh, option.description.en)}`),
  ].join('\n')
}

function printCommandHelp(command: string) {
  const help = getAutomatorCommandHelp(command)
  if (help) {
    console.log(help)
    return
  }

  logger.warn(i18nText(`命令 ${command} 暂无帮助信息`, `No help available for command: ${command}`))
}

function createDefinition(input: {
  description: LocalizedText
  usage: string
  handler: CommandHandler
  options?: Array<{ flag: string, description: LocalizedText }>
  allowedOptions?: string[]
}): CommandDefinition {
  const options = input.options ?? []
  const allowedOptions = new Set<string>([...COMMON_ALLOWED_OPTIONS, ...(input.allowedOptions ?? [])])

  return {
    description: input.description,
    usage: input.usage,
    options,
    allowedOptions,
    handler: input.handler,
  }
}

function validateUnsupportedOptions(command: string, argv: readonly string[], allowedOptions: Set<string>) {
  for (const token of argv) {
    if (!token.startsWith('-')) {
      continue
    }

    const optionName = token.includes('=') ? token.slice(0, token.indexOf('=')) : token
    if (allowedOptions.has(optionName)) {
      continue
    }

    throw new Error(i18nText(
      `'${command}' 命令不支持参数 '${optionName}'`,
      `Unknown option '${optionName}' for '${command}' command`,
    ))
  }
}

function requiredPositional(value: string | undefined, message: string) {
  if (!value) {
    throw new Error(message)
  }
  return value
}
