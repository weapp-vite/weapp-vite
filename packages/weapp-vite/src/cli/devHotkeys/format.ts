import type { DevHotkeyDefinition, DevHotkeyState } from './types'
import path from 'pathe'
import packageJson from '../../../package.json'
import { colors } from '../../logger'
import { resolveDevHotkeyRowsByGroup } from './actions'

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

function formatHotkeyRows(rows: readonly DevHotkeyDefinition[]) {
  const key = (value: string) => colors.bold(colors.green(value))
  const formattedRows = rows.map(row => ({
    description: row.description,
    key: key(row.key),
  }))
  const keyColumnWidth = Math.max(...formattedRows.map(row => row.key.length))
  return formattedRows.map(({ key, description }) => `按 ${key.padEnd(keyColumnWidth)}  ${description}`)
}

/**
 * @description 生成带状态的开发态快捷键帮助文本。
 */
export function formatDevHotkeyHelpWithState(state: DevHotkeyState) {
  const sections = resolveDevHotkeyRowsByGroup()
    .filter(section => section.rows.length > 0)
    .flatMap(section => [
      '',
      section.title,
      ...formatHotkeyRows(section.rows),
    ])
  return [
    `${colors.bold(colors.green('DEV'))}  weapp-vite v${packageJson.version}  ${state.projectLabel ?? 'weapp'}`,
    ...sections,
    '',
    `当前状态：${state.currentAction ?? '等待操作'} / MCP ${formatMcpStatus(state)}`,
    ...(state.lastAction ? [`最近操作：${state.lastAction}`] : []),
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
  if (state.lastAction) {
    return `开发快捷键已就绪，最近操作：${state.lastAction}，按 ${key('h')} 显示帮助，按 ${key('q')} 退出`
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
