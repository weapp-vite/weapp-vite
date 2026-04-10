import type { DevHotkeyState } from './types'
import path from 'pathe'
import packageJson from '../../../package.json'
import { colors } from '../../logger'

const FULLWIDTH_ASCII_START = 0xFF01
const FULLWIDTH_ASCII_END = 0xFF5E
const FULLWIDTH_ASCII_OFFSET = 0xFEE0

export const HOTKEY_DEDUP_WINDOW_MS = 32
export const REG_PENDING_PREFIX = /^正在/

function formatProjectLabel(cwd: string) {
  return path.basename(cwd) || cwd
}

function formatMcpStatus(state: DevHotkeyState) {
  if (!state.mcpEnabled) {
    return '已禁用'
  }
  return state.mcpRunning ? '运行中' : '未启动'
}

function formatFooterLine(state: DevHotkeyState) {
  if (state.currentAction) {
    return `执行中    ${state.currentAction}`
  }
  return '就绪      等待操作...'
}

/**
 * @description 生成带状态的开发态快捷键帮助文本。
 */
export function formatDevHotkeyHelpWithState(state: DevHotkeyState) {
  const key = (value: string) => colors.bold(colors.green(value))
  const actionRows = [
    { key: key('s'), description: '截图当前页面并保存到本地' },
    { key: key('m'), description: '开关 MCP 服务' },
  ]
  const processRows = [
    { key: key('q'), description: '退出当前 dev' },
    { key: key('Ctrl+C'), description: '强制中断当前 dev' },
    { key: key('Ctrl+Z'), description: '暂时挂起当前 dev，恢复终端控制' },
  ]
  const helpRows = [
    { key: key('h'), description: '重新显示这份帮助' },
  ]
  const keyColumnWidth = Math.max(...[...actionRows, ...processRows, ...helpRows].map(row => row.key.length))
  const formatRows = (rows: { key: string, description: string }[]) => rows.map(({ key, description }) =>
    `按 ${key.padEnd(keyColumnWidth)}  ${description}`,
  )
  return [
    `${colors.bold(colors.green('DEV'))}  weapp-vite v${packageJson.version}  ${state.projectLabel ?? 'weapp'}`,
    '',
    '快捷命令',
    ...formatRows(actionRows),
    '',
    '进程控制',
    ...formatRows(processRows),
    '',
    '帮助',
    ...formatRows(helpRows),
    '',
    `当前状态：${state.currentAction ?? '等待操作'} / MCP ${formatMcpStatus(state)}`,
  ].join('\n')
}

/**
 * @description 生成带状态的开发态快捷键简短提示。
 */
export function formatDevHotkeyHintWithState(state: DevHotkeyState) {
  const key = (value: string) => colors.bold(colors.green(value))
  if (state.currentAction) {
    return `${formatFooterLine(state)}，按 ${key('h')} 显示帮助，按 ${key('q')} 退出`
  }
  return `开发快捷键已就绪，按 ${key('h')} 显示帮助，按 ${key('q')} 退出`
}

/**
 * @description 生成开发态快捷键帮助文本。
 */
export function formatDevHotkeyHelp() {
  return formatDevHotkeyHelpWithState({
    mcpEnabled: true,
    mcpRunning: false,
    projectLabel: 'weapp',
  })
}

/**
 * @description 生成开发态快捷键简短提示。
 */
export function formatDevHotkeyHint() {
  return formatDevHotkeyHintWithState({
    mcpEnabled: true,
    mcpRunning: false,
    projectLabel: 'weapp',
  })
}

export function normalizeInputChar(input: string) {
  if (input.length !== 1) {
    return input
  }
  const codePoint = input.codePointAt(0)
  if (!codePoint) {
    return input
  }
  if (codePoint >= FULLWIDTH_ASCII_START && codePoint <= FULLWIDTH_ASCII_END) {
    return String.fromCodePoint(codePoint - FULLWIDTH_ASCII_OFFSET)
  }
  return input
}

export function resolveProjectLabel(cwd: string) {
  return formatProjectLabel(cwd)
}
