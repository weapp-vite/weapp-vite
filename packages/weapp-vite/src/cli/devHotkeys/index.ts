import type { WeappViteMcpServerHandle } from '../../mcp'
import type { DevHotkeysSession, DevHotkeyState, HotkeyInputSource, StartDevHotkeysOptions } from './types'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { closeSharedMiniProgram, createSharedInputSession } from 'weapp-ide-cli'
import logger from '../../logger'
import { resolveWeappMcpConfig } from '../../mcp'
import { resolveRunnableHotkeyDefinition } from './actions'
import { formatDevHotkeyHelp, formatDevHotkeyHelpWithState, formatDevHotkeyHint, formatDevHotkeyHintWithState, HOTKEY_DEDUP_WINDOW_MS, normalizeInputChar, REG_PENDING_PREFIX, resolveProjectLabel } from './format'
import { createToggleMcpAction } from './mcp'
import { resolveDevScreenshotOutputPath, runScreenshotAction } from './screenshot'

export type { DevHotkeysSession, StartDevHotkeysOptions } from './types'

function forwardSigint() {
  process.kill(process.pid, 'SIGINT')
}

function forwardSigtstp() {
  process.kill(process.pid, 'SIGTSTP')
}

export { formatDevHotkeyHelp, formatDevHotkeyHelpWithState, formatDevHotkeyHint, formatDevHotkeyHintWithState, resolveDevScreenshotOutputPath, runScreenshotAction }

/**
 * @description 在开发态启动终端快捷键，并将动作输出到本地日志。
 */
export function startDevHotkeys(options: StartDevHotkeysOptions): DevHotkeysSession | undefined {
  if (options.platform !== 'weapp' || !process.stdin.isTTY) {
    return
  }

  let closed = false
  let running = false
  let mcpHandle: WeappViteMcpServerHandle | undefined
  let onData: ((chunk: string | Uint8Array) => void) | undefined
  let onKeypress: ((str: string, key: { name?: string, ctrl?: boolean } | undefined) => void) | undefined
  let onSigcont: (() => void) | undefined
  let currentAction: string | undefined
  let lastAction: string | undefined
  let lastRenderedPanel = ''
  const recentInputs = new Map<string, string>()
  const resolvedMcp = resolveWeappMcpConfig(options.mcpConfig)
  const getState = (): DevHotkeyState => ({
    currentAction,
    lastAction,
    mcpEnabled: resolvedMcp.enabled,
    mcpRunning: Boolean(mcpHandle?.close),
    projectLabel: resolveProjectLabel(options.cwd),
  })
  let inputSession = createSharedInputSession({
    onData: (chunk) => {
      onData?.(chunk)
    },
    onKeypress: (str, key) => {
      onKeypress?.(str, key)
    },
  })
  const close = () => {
    if (closed) {
      return
    }
    closed = true
    if (onSigcont) {
      process.off('SIGCONT', onSigcont)
    }
    inputSession?.close()
    inputSession = undefined
    if (mcpHandle?.close) {
      void mcpHandle.close().catch((error) => {
        logger.warn(`[dev action] MCP 服务关闭失败：${error instanceof Error ? error.message : String(error)}`)
      })
    }
    void closeSharedMiniProgram(options.projectPath).catch((error) => {
      logger.warn(`[dev action] DevTools 会话关闭失败：${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const printPanel = (message: string, force = false) => {
    if (!force && message === lastRenderedPanel) {
      return
    }
    lastRenderedPanel = message
    logger.info(message)
  }

  const printHelp = () => {
    printPanel(formatDevHotkeyHelpWithState(getState()), true)
  }

  const printHint = () => {
    printPanel(formatDevHotkeyHintWithState(getState()))
  }
  const restore = () => {
    if (closed) {
      return
    }
    inputSession?.resume()
    printHint()
  }

  const suspend = () => {
    lastRenderedPanel = ''
    inputSession?.suspend()
    forwardSigtstp()
  }
  const toggleMcp = createToggleMcpAction({
    cwd: options.cwd,
    getHandle: () => mcpHandle,
    resolvedMcp,
    setHandle: (handle) => {
      mcpHandle = handle
    },
  })
  const resolvePendingLabel = (input: string) => {
    if (input === 'm') {
      return mcpHandle?.close ? '正在关闭 MCP 服务' : '正在启动 MCP 服务'
    }
    return undefined
  }

  const runAction = (
    label: string,
    pendingLabel: string,
    action: () => Promise<string | undefined>,
  ) => {
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

  const handleInput = (input: string) => {
    if (closed) {
      return
    }
    const normalizedInput = normalizeInputChar(input)
    if (normalizedInput === '\u0003') {
      close()
      forwardSigint()
      return
    }
    if (normalizedInput === '\u001A') {
      suspend()
      return
    }
    const normalized = normalizedInput.toLowerCase()
    if (normalized === 'q') {
      close()
      forwardSigint()
      return
    }
    if (normalized === 'h') {
      printHelp()
      return
    }
    const action = resolveRunnableHotkeyDefinition(normalizedInput) ?? resolveRunnableHotkeyDefinition(normalized)
    const run = action?.run
    if (run) {
      runAction(
        action.label ?? action.description,
        resolvePendingLabel(normalized) ?? action.pendingLabel ?? `正在执行 ${action.description}`,
        async () => {
          return await run({
            options,
            toggleMcp,
          })
        },
      )
    }
  }

  const handleInputOnce = (input: string, source: HotkeyInputSource) => {
    const normalizedInput = normalizeInputChar(input)
    const now = Date.now()

    for (const [token, timestamp] of recentInputs) {
      const parsedTimestamp = Number(timestamp.split(':')[1] ?? 0)
      if (now - parsedTimestamp > HOTKEY_DEDUP_WINDOW_MS) {
        recentInputs.delete(token)
      }
    }

    const dedupKey = normalizedInput
    const recentEntry = recentInputs.get(dedupKey)
    if (recentEntry !== undefined) {
      const [recentSource, recentTimestamp] = recentEntry.split(':')
      if (recentSource !== source && now - Number(recentTimestamp) <= HOTKEY_DEDUP_WINDOW_MS) {
        return
      }
    }

    recentInputs.set(dedupKey, `${source}:${now}`)
    handleInput(normalizedInput)
  }

  onData = (chunk) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    for (const char of text) {
      handleInputOnce(char, 'data')
    }
  }
  onKeypress = (str, key) => {
    if (key?.ctrl && key.name === 'c') {
      handleInputOnce('\u0003', 'keypress')
      return
    }
    if (key?.ctrl && key.name === 'z') {
      handleInputOnce('\u001A', 'keypress')
      return
    }
    if (typeof str === 'string' && str) {
      handleInputOnce(str, 'keypress')
    }
  }
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
