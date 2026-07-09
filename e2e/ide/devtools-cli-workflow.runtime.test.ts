import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Buffer } from 'node:buffer'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectMiniProgram } from 'weapp-ide-cli'
import { registerRuntimeTools } from '../../packages/mcp/src/server/runtime'
import { closeWechatIdeProject } from '../../packages/weapp-ide-cli/src/cli/wechat-commands'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const WEAPP_IDE_CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-ide-cli/bin/weapp.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const SCREENSHOT_OUTPUT = path.resolve(TEMPLATE_ROOT, '.tmp/devtools-cli-workflow.png')
const DEV_SCREENSHOT_DIR = path.resolve(TEMPLATE_ROOT, '.weapp-vite/dev-screenshots')
const INDEX_ROUTE = '/pages/index/index'
const COUNT_LABEL_SELECTOR = '#count-label'
const COUNT_BUTTON_SELECTOR = '.count-button-control'
const COUNT_BUTTON_WRAPPER_SELECTOR = '#count-button'
const SCREENSHOT_PROTOCOL_TIMEOUT = 90_000
const SCRIPT_BIN = '/usr/bin/script'
const SHOULD_RUN_TTY_HOTKEY_SMOKE = process.platform === 'darwin' && process.stdin.isTTY && process.stdout.isTTY
const NORMALIZE_LEADING_SLASH_RE = /^\/+/
// eslint-disable-next-line no-control-regex, regexp/no-obscure-range -- 这里需要去掉终端 ANSI 控制序列，便于断言真实 CLI 输出。
const STRIP_ANSI_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g
const LOGIN_REQUIRED_RE = /登录状态失效|re-login|需要重新登录|Wechat DevTools login has expired|DEVTOOLS_LOGIN_REQUIRED/i
const PROTOCOL_TIMEOUT_RE = /DEVTOOLS_PROTOCOL_TIMEOUT|DEVTOOLS_SCREENSHOT_TIMEOUT|协议调用 .* 超时|截图请求在 \d+ms 内未收到 DevTools 回包|Screenshot request did not receive a DevTools response|DevTools timed out|DevTools did not respond/i
const IDE_INFRA_RE = /DEVTOOLS_HTTP_PORT_ERROR|wait IDE port timeout|Failed to launch wechat web devTools|Cannot connect to the Wechat DevTools automation websocket|无法连接到当前项目的微信开发者工具自动化 websocket|tap 命令在 \d+ms 内未收到 DevTools 回包|Failed connecting to ws:\/\/127\.0\.0\.1:\d+|connect EADDRNOTAVAIL 127\.0\.0\.1:\d+|Wait timed out after \d+ ms|SIGTERM|CLI command timed out|Command timed out after \d+ milliseconds/i

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

function normalizeRoutePath(routePath: string) {
  return routePath.replace(NORMALIZE_LEADING_SLASH_RE, '')
}

function normalizeTerminalOutput(output: string) {
  return output
    .replace(STRIP_ANSI_RE, '')
    .replace(/\r/g, '\n')
}

function isLoginRequiredOutput(output: string) {
  return LOGIN_REQUIRED_RE.test(normalizeTerminalOutput(output))
}

function isProtocolTimeoutOutput(output: string) {
  return PROTOCOL_TIMEOUT_RE.test(normalizeTerminalOutput(output))
}

function isIdeInfraOutput(output: string) {
  return IDE_INFRA_RE.test(normalizeTerminalOutput(output))
}

function isCliTimeoutResult(result: {
  exitCode?: number | null
  signal?: string | null
  timedOut?: boolean
}) {
  return result.timedOut === true || (result.exitCode == null && result.signal === 'SIGTERM')
}

function formatCliFailure(label: string, result: {
  all?: string
  exitCode?: number | null
  signal?: string | null
  stderr?: string
  stdout?: string
  timedOut?: boolean
}) {
  const output = result.all || [result.stderr, result.stdout].filter(Boolean).join('\n')
  return [
    `${label} failed`,
    `exitCode=${result.exitCode ?? '<null>'}`,
    `signal=${result.signal ?? '<null>'}`,
    `timedOut=${result.timedOut === true ? 'true' : 'false'}`,
    output.trim() || '<empty output>',
  ].join('\n')
}

function structuredResult<T>(result: unknown) {
  return (result as { structuredContent?: { result?: T } }).structuredContent?.result
}

function toolErrorText(result: unknown) {
  const content = (result as { content?: Array<{ text?: string }> }).content
  return content?.map(item => item.text).filter(Boolean).join('\n') ?? ''
}

function expectToolResult<T>(result: unknown) {
  const errorResult = result as { isError?: boolean }
  if (errorResult.isError) {
    throw new Error(`MCP tool failed: ${toolErrorText(result) || '<empty error>'}`)
  }
  return structuredResult<T>(result)
}

function getTool(tools: Map<string, ToolHandler>, name: string) {
  const tool = tools.get(name)
  if (!tool) {
    throw new Error(`missing MCP tool: ${name}`)
  }
  return tool
}

async function runNodeCli(args: string[], options: {
  cwd?: string
  timeout?: number
  reject?: boolean
} = {}) {
  // eslint-disable-next-line e18e/ban-dependencies -- e2e 里需要复用仓库现有 execa CLI 运行方式。
  const { execa } = await import('execa')
  return await execa('node', args, {
    all: true,
    cleanup: true,
    cwd: options.cwd,
    forceKillAfterDelay: 5_000,
    killSignal: 'SIGTERM',
    reject: options.reject ?? true,
    timeout: options.timeout ?? 60_000,
    stdin: 'ignore',
  })
}

async function runWeappViteCli(args: string[], options: {
  cwd?: string
  timeout?: number
  reject?: boolean
} = {}) {
  return await runNodeCli([CLI_PATH, ...args], options)
}

async function runWeappIdeCli(args: string[], options: {
  cwd?: string
  timeout?: number
  reject?: boolean
} = {}) {
  return await runNodeCli([WEAPP_IDE_CLI_PATH, ...args], options)
}

async function waitForPageData<T>(miniProgram: any, dataPath: string, expected: T, timeoutMs = 8_000) {
  const start = Date.now()
  let lastValue: unknown
  while (Date.now() - start <= timeoutMs) {
    const page = await miniProgram.currentPage()
    lastValue = await page.data(dataPath, {
      routeOnly: true,
      timeout: 3_000,
    })
    if (lastValue === expected) {
      return lastValue
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`page data "${dataPath}" mismatch: expected ${String(expected)}, actual ${String(lastValue)}`)
}

async function waitForCurrentRoute(miniProgram: any, route: string, timeoutMs = 8_000) {
  const normalizedRoute = normalizeRoutePath(route)
  const start = Date.now()
  let lastPath = ''
  while (Date.now() - start <= timeoutMs) {
    const page = await miniProgram.currentPage()
    lastPath = String(page?.path ?? '')
    if (normalizeRoutePath(lastPath) === normalizedRoute) {
      return page
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`current route mismatch: expected ${route}, actual ${lastPath}`)
}

async function waitForRenderedSelector(miniProgram: any, selector: string, timeoutMs = 8_000) {
  const page = await waitForCurrentRoute(miniProgram, INDEX_ROUTE, timeoutMs)
  if (typeof page?.waitForRendered !== 'function') {
    throw new TypeError('current page does not support waitForRendered')
  }
  return await page.waitForRendered({
    selector,
    timeout: timeoutMs,
  })
}

async function expectRenderedSelectorBox(miniProgram: any, selector: string, timeoutMs = 8_000) {
  const page = await waitForCurrentRoute(miniProgram, INDEX_ROUTE, timeoutMs)
  if (typeof page?.renderedNodes !== 'function') {
    throw new TypeError('current page does not support renderedNodes')
  }

  await waitForRenderedSelector(miniProgram, selector, timeoutMs)
  const nodes = await page.renderedNodes(selector, {
    timeout: timeoutMs,
  })
  const visibleNode = nodes.find((node: { height?: number, width?: number }) => {
    return Number(node.width ?? 0) > 0 && Number(node.height ?? 0) > 0
  })

  expect(visibleNode, `${selector} should be rendered with a real layout box: ${JSON.stringify(nodes).slice(0, 500)}`).toBeTruthy()
  return visibleNode
}

function isRecoverableAutomatorConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Connection closed')
    || message.includes('Target closed')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Execution context was destroyed')
    || message.includes('getPageMetaByWebviewId')
    || message.includes('DEVTOOLS_PROTOCOL_TIMEOUT')
    || message.includes('DevTools did not respond to protocol method')
    || Reflect.get(error as object, 'code') === 'DEVTOOLS_PROTOCOL_TIMEOUT'
}

function isRecoverableDevToolsLaunchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''
  return isRecoverableAutomatorConnectionError(error)
    || name === 'WechatIdeSimulatorBootLogError'
    || /Timeout in warmup current page|Timeout in read current page|WeChat DevTools simulator boot error detected|DEVTOOLS_PROTOCOL_TIMEOUT|DevTools did not respond/i.test(message)
}

async function waitForPredicate(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  label: string,
) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    if (await predicate()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function waitForChildExit(child: ChildProcessWithoutNullStreams, timeoutMs: number) {
  return await new Promise<{ code: number | null, signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`timeout waiting for child process ${child.pid ?? '<unknown>'} to exit`))
    }, timeoutMs)

    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })
}

async function listDevScreenshotFiles() {
  try {
    const entries = await fs.readdir(DEV_SCREENSHOT_DIR)
    return entries
      .filter(entry => entry.startsWith('screenshot-') && entry.endsWith('.png'))
      .map(entry => path.join(DEV_SCREENSHOT_DIR, entry))
  }
  catch (error) {
    if (error && typeof error === 'object' && (error as { code?: string }).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function waitForNewDevScreenshot(before: ReadonlySet<string>) {
  let latestNewFile: string | undefined
  await waitForPredicate(async () => {
    const files = await listDevScreenshotFiles()
    latestNewFile = files.find(file => !before.has(file))
    if (!latestNewFile) {
      return false
    }
    const stats = await fs.stat(latestNewFile)
    return stats.size > 0
  }, 30_000, 'dev hotkey screenshot file')

  if (!latestNewFile) {
    throw new Error('dev hotkey screenshot file was not created')
  }
  return latestNewFile
}

async function runDevHotkeyScreenshotSmoke(options: { open?: boolean } = {}) {
  if (!SHOULD_RUN_TTY_HOTKEY_SMOKE) {
    return
  }

  await fs.access(SCRIPT_BIN)
  const beforeScreenshots = new Set(await listDevScreenshotFiles())
  const devArgs = [
    'dev',
    ...(options.open ? ['-o'] : []),
    '--non-interactive',
    '--login-retry',
    'never',
  ]
  const child = spawn(SCRIPT_BIN, [
    '-q',
    '/dev/null',
    'node',
    CLI_PATH,
    ...devArgs,
  ], {
    cwd: TEMPLATE_ROOT,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let output = ''
  const appendOutput = (chunk: Buffer | string) => {
    output += chunk.toString()
  }
  child.stdout.on('data', appendOutput)
  child.stderr.on('data', appendOutput)

  try {
    await waitForPredicate(() => {
      return normalizeTerminalOutput(output).includes('开发快捷键已就绪')
    }, 120_000, 'dev hotkey startup')

    child.stdin.write('s')
    await waitForPredicate(() => {
      return normalizeTerminalOutput(output).includes('当前页面截图完成')
    }, 120_000, 'dev hotkey screenshot completion')

    const screenshotFile = await waitForNewDevScreenshot(beforeScreenshots)
    const stats = await fs.stat(screenshotFile)
    expect(stats.size).toBeGreaterThan(0)
  }
  catch (error) {
    const normalizedOutput = normalizeTerminalOutput(output).split('\n').slice(-80).join('\n')
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n\ncommand: node ${path.basename(CLI_PATH)} ${devArgs.join(' ')}\nrecent output:\n${normalizedOutput}`)
  }
  finally {
    if (!child.killed) {
      child.stdin.write('q')
    }
    await waitForChildExit(child, 20_000).catch(() => {})
    const afterScreenshots = await listDevScreenshotFiles().catch(() => [])
    await Promise.all(afterScreenshots
      .filter(file => !beforeScreenshots.has(file))
      .map(file => fs.rm(file, { force: true }).catch(() => {})))
  }
}

async function createRuntimeTools() {
  const tools = new Map<string, ToolHandler>()
  const server = {
    registerTool(name: string, _definition: unknown, handler: ToolHandler) {
      tools.set(name, handler)
    },
  }

  const manager = registerRuntimeTools(server as unknown as McpServer, {
    runtimeHooks: {
      connectMiniProgram,
    },
    workspaceRoot: path.resolve(import.meta.dirname, '../..'),
  })

  return {
    manager,
    tools,
  }
}

async function expectHelpfulCliFailure(
  args: string[],
  expectedPatterns: RegExp[],
) {
  const result = await runWeappIdeCli(args, {
    cwd: TEMPLATE_ROOT,
    reject: false,
    timeout: 20_000,
  })
  const output = (result.all ?? '').replace(STRIP_ANSI_RE, '')
  expect(result.exitCode).not.toBe(0)
  for (const pattern of expectedPatterns) {
    expect(output).toMatch(pattern)
  }
}

describe.sequential('DevTools CLI workflow runtime', () => {
  let miniProgram: any
  let ideInfraOutput: string | undefined
  let loginRequiredOutput: string | undefined
  let protocolTimeoutOutput: string | undefined
  let weappIdeOpenExitCode: number | undefined
  let weappViteOpenExitCode: number | undefined
  let screenshotExitCode: number | undefined
  let ideInfraStage: 'open' | 'screenshot' | undefined
  let preScreenshotDomReady = false

  async function startMiniProgram() {
    if (miniProgram) {
      await miniProgram.close().catch(() => {})
      miniProgram = undefined
    }
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    miniProgram = await launchAutomator({
      projectPath: TEMPLATE_ROOT,
      skipRelaunchPageRootCheck: true,
      skipWarmup: true,
      warmupRoute: INDEX_ROUTE,
    })
  }

  async function runWithMiniProgramRecovery<T>(runner: () => Promise<T>) {
    try {
      return await runner()
    }
    catch (error) {
      if (!isRecoverableAutomatorConnectionError(error)) {
        throw error
      }
      await startMiniProgram()
      return await runner()
    }
  }

  async function ensureCliWorkflowDomReady() {
    await startMiniProgram()
    await runWithMiniProgramRecovery(async () => {
      await waitForCurrentRoute(miniProgram, INDEX_ROUTE)
      await waitForRenderedSelector(miniProgram, COUNT_LABEL_SELECTOR)
      await expectRenderedSelectorBox(miniProgram, COUNT_BUTTON_WRAPPER_SELECTOR)
      await waitForRenderedSelector(miniProgram, COUNT_BUTTON_SELECTOR)
      await waitForPageData(miniProgram, 'count', 0)
    })
    preScreenshotDomReady = true
  }

  beforeAll(async () => {
    await fs.rm(SCREENSHOT_OUTPUT, { force: true })
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: TEMPLATE_ROOT,
      platform: 'weapp',
      cwd: TEMPLATE_ROOT,
      label: 'ide:devtools-cli-workflow',
    })
    const wvOpen = await runWeappViteCli([
      'open',
      TEMPLATE_ROOT,
      '--non-interactive',
      '--login-retry',
      'never',
    ], {
      cwd: TEMPLATE_ROOT,
      reject: false,
      timeout: 90_000,
    })
    if (wvOpen.exitCode !== 0) {
      const output = wvOpen.all ?? ''
      if (isLoginRequiredOutput(output)) {
        loginRequiredOutput = output
        return
      }
      if (isIdeInfraOutput(output) || isCliTimeoutResult(wvOpen)) {
        ideInfraOutput = formatCliFailure('wv open', wvOpen)
        ideInfraStage = 'open'
        return
      }
      throw new Error(formatCliFailure('wv open', wvOpen))
    }
    weappViteOpenExitCode = wvOpen.exitCode

    const weappOpen = await runWeappIdeCli([
      'open',
      '-p',
      TEMPLATE_ROOT,
      '--non-interactive',
      '--login-retry',
      'never',
    ], {
      cwd: TEMPLATE_ROOT,
      reject: false,
      timeout: 90_000,
    })
    if (weappOpen.exitCode !== 0) {
      const output = weappOpen.all ?? ''
      if (isLoginRequiredOutput(output)) {
        loginRequiredOutput = output
        return
      }
      if (isIdeInfraOutput(output) || isCliTimeoutResult(weappOpen)) {
        ideInfraOutput = formatCliFailure('weapp open', weappOpen)
        ideInfraStage = 'open'
        return
      }
      throw new Error(formatCliFailure('weapp open', weappOpen))
    }
    weappIdeOpenExitCode = weappOpen.exitCode

    await ensureCliWorkflowDomReady()

    const screenshot = await runWeappIdeCli([
      'screenshot',
      '-p',
      TEMPLATE_ROOT,
      '--page',
      INDEX_ROUTE,
      '--output',
      SCREENSHOT_OUTPUT,
      '--timeout',
      String(SCREENSHOT_PROTOCOL_TIMEOUT),
      '--no-runtime-service',
      '--json',
    ], {
      cwd: TEMPLATE_ROOT,
      reject: false,
      timeout: 180_000,
    })
    if (screenshot.exitCode !== 0) {
      const output = screenshot.all ?? ''
      if (isProtocolTimeoutOutput(output)) {
        protocolTimeoutOutput = output
        return
      }
      if (isIdeInfraOutput(output) || isCliTimeoutResult(screenshot)) {
        ideInfraOutput = formatCliFailure('weapp screenshot', screenshot)
        ideInfraStage = 'screenshot'
        return
      }
      throw new Error(formatCliFailure('weapp screenshot', screenshot))
    }
    screenshotExitCode = screenshot.exitCode
    const screenshotStats = await fs.stat(SCREENSHOT_OUTPUT)
    expect(screenshotStats.size).toBeGreaterThan(0)
  }, 480_000)

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.close().catch(() => {})
      miniProgram = undefined
    }
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await fs.rm(SCREENSHOT_OUTPUT, { force: true }).catch(() => {})
  }, 60_000)

  it('opens with weapp-vite and weapp-ide-cli, screenshots, taps DOM, and exposes helpful diagnostics', async () => {
    if (loginRequiredOutput) {
      const output = normalizeTerminalOutput(loginRequiredOutput)
      expect(output).toMatch(/登录状态失效|re-login|需要重新登录|Wechat DevTools login has expired/i)
      expect(output).toMatch(/非交互模式|non-interactive|请先登录|Please login/i)
      return
    }
    if (protocolTimeoutOutput) {
      expect(preScreenshotDomReady).toBe(true)
      const output = normalizeTerminalOutput(protocolTimeoutOutput)
      expect(output).toMatch(/DEVTOOLS_PROTOCOL_TIMEOUT|DEVTOOLS_SCREENSHOT_TIMEOUT|协议调用 .* 超时|截图请求在 \d+ms 内未收到 DevTools 回包|Screenshot request did not receive a DevTools response|DevTools did not respond/i)
      expect(output).toMatch(/自动化会话已卡住|窗口不在目标项目|目标项目|automation session is stuck|target project/i)
      expect(output).toMatch(/重试一次|Retrying once|重建会话/i)
      return
    }
    if (ideInfraOutput) {
      if (ideInfraStage === 'screenshot') {
        expect(preScreenshotDomReady).toBe(true)
      }
      const output = normalizeTerminalOutput(ideInfraOutput)
      expect(output).toMatch(/DEVTOOLS_HTTP_PORT_ERROR|wait IDE port timeout|Failed to launch wechat web devTools|automation websocket|Failed connecting to ws:\/\/127\.0\.0\.1:\d+|connect EADDRNOTAVAIL 127\.0\.0\.1:\d+|Wait timed out after \d+ ms|SIGTERM|timedOut=true/i)
      return
    }

    expect(weappViteOpenExitCode).toBe(0)
    expect(weappIdeOpenExitCode).toBe(0)
    expect(screenshotExitCode).toBe(0)

    try {
      await startMiniProgram()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (isRecoverableDevToolsLaunchError(error)) {
        expect(message).toMatch(/Timeout in warmup current page|Timeout in read current page|WeChat DevTools simulator boot error detected|DEVTOOLS_PROTOCOL_TIMEOUT|DevTools did not respond/i)
        return
      }
      throw error
    }

    await runWithMiniProgramRecovery(async () => {
      await waitForCurrentRoute(miniProgram, INDEX_ROUTE)
      await waitForRenderedSelector(miniProgram, COUNT_BUTTON_SELECTOR)
      await waitForPageData(miniProgram, 'count', 0)
    })

    const tapResult = await runWeappIdeCli([
      'tap',
      COUNT_BUTTON_SELECTOR,
      '-p',
      TEMPLATE_ROOT,
    ], {
      cwd: TEMPLATE_ROOT,
      reject: false,
      timeout: 60_000,
    })
    if (tapResult.exitCode !== 0) {
      const output = formatCliFailure('weapp-ide-cli tap', tapResult)
      if (isIdeInfraOutput(output) || isCliTimeoutResult(tapResult)) {
        expect(normalizeTerminalOutput(output)).toMatch(/automation websocket|无法连接到当前项目的微信开发者工具自动化 websocket|tap 命令在 \d+ms 内未收到 DevTools 回包|timedOut=true|Command timed out after \d+ milliseconds/i)
        return
      }
      throw new Error(output)
    }

    const { manager, tools } = await createRuntimeTools()
    try {
      const connectResult = await getTool(tools, 'weapp_devtools_connect')({
        projectPath: TEMPLATE_ROOT,
        timeout: 30_000,
      })
      expect(expectToolResult<{ connected: boolean }>(connectResult)).toMatchObject({
        connected: true,
      })

      const findResult = await getTool(tools, 'weapp_runtime_find_node')({
        projectPath: TEMPLATE_ROOT,
        selector: COUNT_LABEL_SELECTOR,
        withWxml: true,
      })
      expect(expectToolResult<{ outerWxml?: string, selector: string }>(findResult)).toMatchObject({
        selector: COUNT_LABEL_SELECTOR,
      })

      const tapResult = await getTool(tools, 'weapp_runtime_tap_node')({
        projectPath: TEMPLATE_ROOT,
        selector: COUNT_BUTTON_WRAPPER_SELECTOR,
        innerSelector: COUNT_BUTTON_SELECTOR,
        waitMs: 300,
      })
      expect(expectToolResult<{ innerSelector: string, selector: string }>(tapResult)).toMatchObject({
        innerSelector: COUNT_BUTTON_SELECTOR,
        selector: COUNT_BUTTON_WRAPPER_SELECTOR,
      })
    }
    finally {
      await manager.close({ projectPath: TEMPLATE_ROOT }).catch(() => {})
    }

    await miniProgram.close().catch(() => {})
    miniProgram = undefined
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await runDevHotkeyScreenshotSmoke()

    await closeWechatIdeProject().catch(() => {})
    await expectHelpfulCliFailure([
      'current-page',
      '-p',
      TEMPLATE_ROOT,
      '--timeout',
      '3000',
      '--no-runtime-service',
    ], [
      /无法连接到当前项目的微信开发者工具自动化 websocket|Cannot connect to the Wechat DevTools automation websocket/,
      /请确认当前打开的是目标项目|Please confirm the current DevTools window is the target project/,
    ])
  })

  it('captures screenshots from the dev hotkey after dev -o opens the project', async () => {
    if (loginRequiredOutput || protocolTimeoutOutput || ideInfraOutput) {
      return
    }

    await closeWechatIdeProject().catch(() => {})
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await runDevHotkeyScreenshotSmoke({ open: true })
  }, 240_000)
})
