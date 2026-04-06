import type { ScreenshotResult } from 'weapp-ide-cli'
import type { WeappViteMcpServerHandle } from '../mcp'
import type { WeappMcpConfig } from '../types'
import fs from 'node:fs/promises'
import process from 'node:process'
import { emitKeypressEvents } from 'node:readline'
import path from 'pathe'
import { takeScreenshot } from 'weapp-ide-cli'
import { VERSION } from '../constants'
import logger, { colors } from '../logger'
import { resolveWeappMcpConfig, startWeappViteMcpServer } from '../mcp'

export interface StartDevHotkeysOptions {
  cwd: string
  mcpConfig?: boolean | WeappMcpConfig
  platform?: string
  projectPath: string
  silentStartupHint?: boolean
}

export interface DevHotkeysSession {
  close: () => void
  restore: () => void
}

interface DevHotkeyState {
  currentAction?: string
  lastAction?: string
  mcpEnabled: boolean
  mcpRunning: boolean
  projectLabel?: string
}

const DEV_SCREENSHOT_DIR = '.tmp/weapp-vite-dev-screenshots'
const DEFAULT_SCREENSHOT_TIMEOUT = 30_000
const REG_PENDING_PREFIX = /^正在/

function formatMcpUrl(host: string, port: number, endpoint: string) {
  return `http://${host}:${port}${endpoint}`
}

function forwardSigint() {
  process.kill(process.pid, 'SIGINT')
}

function forwardSigtstp() {
  process.kill(process.pid, 'SIGTSTP')
}

function formatProjectLabel(cwd: string) {
  return path.basename(cwd) || cwd
}

function formatSessionHeader(projectLabel?: string) {
  const parts = [
    colors.bold(colors.green('DEV')),
    `weapp-vite v${VERSION}`,
    projectLabel ?? 'weapp',
  ]
  return parts.join('  ')
}

function formatMcpStatus(state: DevHotkeyState) {
  if (!state.mcpEnabled) {
    return '已禁用'
  }
  return state.mcpRunning ? '运行中' : '未启动'
}

function formatStatusLines(state: DevHotkeyState) {
  return [
    `状态        ${state.currentAction ?? '等待操作'}`,
    `MCP         ${formatMcpStatus(state)}`,
    ...(state.lastAction ? [`最近操作    ${state.lastAction}`] : []),
  ]
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
    `press ${key.padEnd(keyColumnWidth)}  ${description}`,
  )
  return [
    '',
    formatSessionHeader(state.projectLabel),
    '',
    ...formatStatusLines(state),
    '',
    formatFooterLine(state),
    `按 ${key('h')} 显示帮助，按 ${key('q')} 退出`,
    '',
    '快捷命令',
    ...formatRows(actionRows),
    '',
    '进程控制',
    ...formatRows(processRows),
    '',
    '帮助',
    ...formatRows(helpRows),
  ].join('\n')
}

/**
 * @description 生成带状态的开发态快捷键简短提示。
 */
export function formatDevHotkeyHintWithState(state: DevHotkeyState) {
  const key = (value: string) => colors.bold(colors.green(value))
  return [
    '',
    formatSessionHeader(state.projectLabel),
    '',
    ...formatStatusLines(state),
    '',
    formatFooterLine(state),
    `按 ${key('h')} 显示帮助，按 ${key('q')} 退出`,
  ].join('\n')
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

/**
 * @description 生成开发态截图输出路径。
 */
export function resolveDevScreenshotOutputPath(cwd: string, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return path.join(cwd, DEV_SCREENSHOT_DIR, `screenshot-${stamp}.png`)
}

function formatLogPath(cwd: string, targetPath: string) {
  const relativePath = path.relative(cwd, targetPath)
  if (!relativePath || relativePath.startsWith('..')) {
    return targetPath
  }
  return relativePath
}

function formatResolvedScreenshotPath(cwd: string, fallbackPath: string, result: ScreenshotResult) {
  return formatLogPath(cwd, result.path ?? fallbackPath)
}

/**
 * @description 执行当前页面截图并输出结果日志。
 */
export async function runScreenshotAction(options: StartDevHotkeysOptions) {
  const outputPath = resolveDevScreenshotOutputPath(options.cwd)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  logger.info(`[dev action] 正在截图当前页面，输出到 ${colors.cyan(formatLogPath(options.cwd, outputPath))}`)
  const result = await takeScreenshot({
    projectPath: options.projectPath,
    outputPath,
    timeout: DEFAULT_SCREENSHOT_TIMEOUT,
  })
  const resolvedPath = formatResolvedScreenshotPath(options.cwd, outputPath, result)
  logger.success(`[dev action] 当前页面截图完成：${colors.cyan(resolvedPath)}`)
  return resolvedPath
}

/**
 * @description 在开发态启动终端快捷键，并将动作输出到本地日志。
 */
export function startDevHotkeys(options: StartDevHotkeysOptions): DevHotkeysSession | undefined {
  if (options.platform !== 'weapp' || !process.stdin.isTTY) {
    return
  }

  emitKeypressEvents(process.stdin)

  const hasSetRawMode = typeof process.stdin.setRawMode === 'function'
  if (hasSetRawMode) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()

  let closed = false
  let running = false
  let mcpHandle: WeappViteMcpServerHandle | undefined
  let onKeypress: (_str: string, key: { name?: string, ctrl?: boolean } | undefined) => void
  let onSigcont: (() => void) | undefined
  let currentAction: string | undefined
  let lastAction: string | undefined
  const resolvedMcp = resolveWeappMcpConfig(options.mcpConfig)
  const getState = (): DevHotkeyState => ({
    currentAction,
    lastAction,
    mcpEnabled: resolvedMcp.enabled,
    mcpRunning: Boolean(mcpHandle?.close),
    projectLabel: formatProjectLabel(options.cwd),
  })
  const detachTerminal = () => {
    if (hasSetRawMode) {
      process.stdin.setRawMode(false)
    }
    process.stdin.pause()
  }
  const attachTerminal = () => {
    if (closed) {
      return
    }
    emitKeypressEvents(process.stdin)
    if (hasSetRawMode) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
  }
  const close = () => {
    if (closed) {
      return
    }
    closed = true
    process.stdin.off('keypress', onKeypress)
    if (onSigcont) {
      process.off('SIGCONT', onSigcont)
    }
    detachTerminal()
    if (mcpHandle?.close) {
      void mcpHandle.close().catch((error) => {
        logger.warn(`[dev action] MCP 服务关闭失败：${error instanceof Error ? error.message : String(error)}`)
      })
    }
  }

  const printHelp = () => {
    logger.info(formatDevHotkeyHelpWithState(getState()))
  }

  const printHint = () => {
    logger.info(formatDevHotkeyHintWithState(getState()))
  }
  const restore = () => {
    if (closed) {
      return
    }
    process.stdin.off('keypress', onKeypress)
    attachTerminal()
    process.stdin.on('keypress', onKeypress)
    printHint()
  }

  const suspend = () => {
    detachTerminal()
    forwardSigtstp()
  }

  const toggleMcp = async () => {
    if (!resolvedMcp.enabled) {
      logger.warn('[dev action] MCP 已在配置中禁用，跳过切换。')
      return 'MCP 已禁用'
    }

    if (mcpHandle?.close) {
      const url = formatMcpUrl(resolvedMcp.host, resolvedMcp.port, resolvedMcp.endpoint)
      logger.info(`[dev action] 正在关闭 MCP 服务：${colors.cyan(url)}`)
      await mcpHandle.close()
      mcpHandle = undefined
      logger.success(`[dev action] MCP 服务已关闭：${colors.cyan(url)}`)
      return `MCP 已关闭 (${url})`
    }

    const url = formatMcpUrl(resolvedMcp.host, resolvedMcp.port, resolvedMcp.endpoint)
    logger.info(`[dev action] 正在启动 MCP 服务：${colors.cyan(url)}`)
    mcpHandle = await startWeappViteMcpServer({
      endpoint: resolvedMcp.endpoint,
      host: resolvedMcp.host,
      port: resolvedMcp.port,
      transport: 'streamable-http',
      unref: false,
      workspaceRoot: options.cwd,
    })
    logger.success(`[dev action] MCP 服务已启动：${colors.cyan(url)}`)
    return `MCP 已启动 (${url})`
  }

  const runAction = (label: string, pendingLabel: string, action: () => Promise<string | undefined>) => {
    if (running) {
      const current = currentAction ?? '已有命令'
      logger.warn(`[dev action] 当前正在${current.replace(REG_PENDING_PREFIX, '')}，请稍后再试。`)
      return
    }

    running = true
    currentAction = pendingLabel
    printHint()
    void action()
      .then((summary) => {
        if (summary) {
          lastAction = summary
        }
      })
      .catch((error) => {
        logger.error(`[dev action] ${label}失败：${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        running = false
        currentAction = undefined
        if (!closed) {
          printHint()
        }
      })
  }

  onKeypress = (_str: string, key: { name?: string, ctrl?: boolean } | undefined) => {
    if (!key || closed) {
      return
    }

    if (key.ctrl && key.name === 'c') {
      close()
      forwardSigint()
      return
    }

    if (key.ctrl && key.name === 'z') {
      suspend()
      return
    }

    if (key.name === 'q') {
      close()
      forwardSigint()
      return
    }

    if (key.name === 'h') {
      printHelp()
      return
    }

    if (key.name === 's') {
      runAction('截图', '正在截图当前页面', async () => {
        const screenshotPath = await runScreenshotAction(options)
        return `截图已保存到 ${screenshotPath}`
      })
      return
    }

    if (key.name === 'm') {
      const pendingLabel = mcpHandle?.close ? '正在关闭 MCP 服务' : '正在启动 MCP 服务'
      runAction('MCP 切换', pendingLabel, async () => {
        return await toggleMcp()
      })
    }
  }

  process.stdin.on('keypress', onKeypress)
  onSigcont = () => {
    restore()
  }
  process.on('SIGCONT', onSigcont)
  if (!options.silentStartupHint) {
    printHint()
  }
  if (resolvedMcp.enabled && resolvedMcp.autoStart) {
    runAction('MCP 自动启动', '正在启动 MCP 服务', async () => {
      await toggleMcp()
    })
  }

  return {
    close,
    restore,
  }
}
