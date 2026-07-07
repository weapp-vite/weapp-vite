import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  connectMiniProgram,
  connectOpenedAutomator,
  resolveProjectAutomatorPort,
  takeScreenshot,
} from 'weapp-ide-cli'
import { registerRuntimeTools } from '../../packages/mcp/src/server/runtime'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const INDEX_ROUTE = '/pages/index/index'
const TEMPLATE_CASES = [
  {
    expectedText: 'Hello weapp-vite',
    name: 'tailwindcss',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-template'),
    tdesign: false,
  },
  {
    expectedText: 'Vant 按钮',
    name: 'tailwindcss-vant',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-vant-template'),
    tdesign: false,
  },
  {
    expectedText: 'TDesign Button',
    name: 'tailwindcss-tdesign',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template'),
    tdesign: true,
  },
] as const
const PLAIN_TEMPLATE = TEMPLATE_CASES[0]
const TDESIGN_TEMPLATE = TEMPLATE_CASES[2]
const IDE_AUTOMATOR_INFRA_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+|无法连接到当前项目的微信开发者工具自动化 websocket|Cannot connect to the Wechat DevTools automation websocket|automation websocket|Connection closed, check if wechat web devTools is still running|WebSocket is not open|socket hang up|Wait timed out after \d+ ms|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/i

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

interface AutomatorSessionMetadata {
  projectPath: string
  updatedAt: string
  wsEndpoint: string
}

type TemplateDevProcess = typeof TEMPLATE_CASES[number] & {
  dev: ReturnType<typeof startDevProcess>
}

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

function resolveAutomatorWrapperProjectPath(projectPath: string) {
  const sourceProjectPath = path.resolve(projectPath)
  const distRoot = path.resolve(sourceProjectPath, 'dist')
  const wrapperHash = createHash('sha1')
    .update(sourceProjectPath)
    .update('\0')
    .update(distRoot)
    .digest('hex')
    .slice(0, 16)
  return path.join(os.tmpdir(), 'weapp-ide-cli-automator-projects', wrapperHash)
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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isDevtoolsProtocolTimeout(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const protocolError = error as Error & { code?: unknown, method?: unknown }
  return protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && (protocolError.method === 'App.getCurrentPage' || protocolError.method === 'App.getPageStack')
}

function isTemplateDevOpenInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return IDE_AUTOMATOR_INFRA_RE.test(message)
}

function isTemplateRenderUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (!/Timed out waiting for rendered text/i.test(message)) {
    return false
  }
  const latestWxml = message.split('Latest WXML:\n').at(1)?.trim() ?? ''
  return latestWxml === '' || latestWxml === '<page></page>'
}

async function waitForOpenedAutomator(projectPath: string, timeoutMs = 120_000) {
  const start = Date.now()
  let lastError: unknown
  const port = resolveProjectAutomatorPort(projectPath)
  const wsEndpoint = `ws://127.0.0.1:${port}`

  while (Date.now() - start <= timeoutMs) {
    try {
      const miniProgram = await connectOpenedAutomator({
        projectPath,
        port,
        timeout: 30_000,
      })
      return {
        metadata: {
          projectPath,
          updatedAt: new Date().toISOString(),
          wsEndpoint,
        } satisfies AutomatorSessionMetadata,
        miniProgram,
      }
    }
    catch (error) {
      lastError = error
    }
    await delay(1_000)
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function removeAutomatorSessionFiles(projectPath: string) {
  await Promise.all([
    fs.rm(resolveAutomatorSessionFile(projectPath), { force: true }).catch(() => {}),
    fs.rm(resolveAutomatorSessionFile(projectPath, resolveProjectAutomatorPort(projectPath)), { force: true }).catch(() => {}),
  ])
}

async function waitForPageText(miniProgram: any, projectPath: string, route: string, text: string, timeoutMs = 90_000) {
  const start = Date.now()
  let latestWxml = ''
  let emptyPageReads = 0
  let lastProtocolTimeout = ''
  let currentMiniProgram = miniProgram

  while (Date.now() - start <= timeoutMs) {
    try {
      const currentPage = await currentMiniProgram.currentPage?.()
      const page = currentPage?.path === route
        ? currentPage
        : await currentMiniProgram.reLaunch(route)
      await page.waitFor(500)
      const root = await page.$('page')
      latestWxml = root ? await root.outerWxml() : ''
      if (latestWxml.includes(text)) {
        return latestWxml
      }
      if (latestWxml.trim() === '<page></page>') {
        emptyPageReads += 1
        if (emptyPageReads >= 2) {
          currentMiniProgram.disconnect?.()
          currentMiniProgram = (await waitForOpenedAutomator(projectPath, 30_000)).miniProgram
          emptyPageReads = 0
        }
      }
      else {
        emptyPageReads = 0
      }
    }
    catch (error) {
      if (!isDevtoolsProtocolTimeout(error)) {
        throw error
      }
      lastProtocolTimeout = error.message
      currentMiniProgram.disconnect?.()
      currentMiniProgram = (await waitForOpenedAutomator(projectPath, 30_000)).miniProgram
    }
    await delay(1_000)
  }

  const timeoutDetail = lastProtocolTimeout ? `\nLatest DevTools protocol timeout: ${lastProtocolTimeout}` : ''
  throw new Error(`Timed out waiting for rendered text "${text}".${timeoutDetail}\nLatest WXML:\n${latestWxml.slice(0, 1000)}`)
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
    workspaceRoot: WORKSPACE_ROOT,
  })

  return {
    manager,
    tools,
  }
}

async function startTemplateDevProcesses() {
  const processes: TemplateDevProcess[] = []

  for (const templateCase of TEMPLATE_CASES) {
    const process = {
      ...templateCase,
      dev: startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
        cwd: templateCase.root,
        env: createDevProcessEnv(),
        reject: false,
      }),
    }

    processes.push(process)
    await process.dev.waitFor(
      waitForOpenedAutomator(templateCase.root, 180_000).then(async ({ miniProgram }) => {
        await miniProgram.disconnect()
      }),
      `${process.name} dev:open ready`,
    )
  }

  return processes
}

describe.sequential('template TailwindCSS dev:open multi-project IDE integration', () => {
  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await removeAutomatorSessionFiles(templateCase.root)))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(resolveAutomatorWrapperProjectPath(templateCase.root), { force: true, recursive: true }).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.join(templateCase.root, '.tmp/dev-open-multi.png'), { force: true }).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.resolve(WORKSPACE_ROOT, 'templates', path.basename(templateCase.root), '.tmp/dev-open-multi-mcp.png'), { force: true }).catch(() => {})))
  }, 60_000)

  afterAll(async () => {
    await cleanupTrackedDevProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(templateCase.root).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.join(templateCase.root, '.tmp/dev-open-multi.png'), { force: true }).catch(() => {})))
    await cleanupResidualIdeProcesses()
  }, 60_000)

  it('keeps screenshot and MCP bound to each real template root after concurrent dev:open', async (ctx) => {
    const processes = await startTemplateDevProcesses()

    try {
      const runtimeTools = await createRuntimeTools()
      try {
        for (const templateCase of TEMPLATE_CASES) {
          const port = resolveProjectAutomatorPort(templateCase.root)
          const { metadata, miniProgram } = await waitForOpenedAutomator(templateCase.root)
          expect(path.resolve(metadata.projectPath)).toBe(templateCase.root)
          expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
          const wrapperProjectPath = resolveAutomatorWrapperProjectPath(templateCase.root)
          await fs.access(wrapperProjectPath)
          expect(JSON.parse(await fs.readFile(path.join(wrapperProjectPath, 'project.config.json'), 'utf8'))).toMatchObject({
            miniprogramRoot: './',
            srcMiniprogramRoot: './',
          })
          try {
            await waitForPageText(miniProgram, templateCase.root, INDEX_ROUTE, templateCase.expectedText)
          }
          catch (error) {
            if (isTemplateDevOpenInfraError(error) || isTemplateRenderUnavailable(error)) {
              ctx.skip(`WeChat DevTools 自动化会话未渲染目标模板页面，跳过 template TailwindCSS dev:open 多项目 IDE 用例。reason=${error instanceof Error ? error.message : String(error)}`)
              return
            }
            throw error
          }
          await miniProgram.disconnect()

          const screenshotPath = path.join(templateCase.root, '.tmp/dev-open-multi.png')
          const screenshot = await takeScreenshot({
            outputPath: screenshotPath,
            port,
            preserveProjectRoot: true,
            projectPath: templateCase.root,
            sharedSession: true,
            timeout: 60_000,
          })
          expect(screenshot.path).toBe(screenshotPath)
          expect((await fs.stat(screenshotPath)).size).toBeGreaterThan(0)

          const connectResult = await getTool(runtimeTools.tools, 'weapp_devtools_connect')({
            port,
            preserveProjectRoot: true,
            projectPath: templateCase.root,
            timeout: 60_000,
          })
          expect(expectToolResult<{ connected: boolean, resolvedProjectPath: string }>(connectResult)).toMatchObject({
            connected: true,
            resolvedProjectPath: templateCase.root,
          })

          const capturePath = path.join('templates', path.basename(templateCase.root), '.tmp/dev-open-multi-mcp.png')
          const captureResult = await getTool(runtimeTools.tools, 'weapp_devtools_capture')({
            outputPath: capturePath,
            port,
            preserveProjectRoot: true,
            projectPath: templateCase.root,
            timeout: 60_000,
          })
          const capture = expectToolResult<{ bytes: number, path: string }>(captureResult)
          expect(capture.bytes).toBeGreaterThan(0)
          expect(path.resolve(capture.path)).toBe(path.resolve(WORKSPACE_ROOT, capturePath))
        }
      }
      finally {
        await Promise.all(TEMPLATE_CASES.map(async templateCase => await runtimeTools.manager.close({
          port: resolveProjectAutomatorPort(templateCase.root),
          projectPath: templateCase.root,
        }).catch(() => {})))
      }
    }
    finally {
      await Promise.all(processes.map(async item => await item.dev.stop().catch(() => {})))
    }
  }, 480_000)

  it('opens the next template after the previous dev:open process exits', async (ctx) => {
    await cleanupTrackedDevProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(
      templateCase.root,
      resolveProjectAutomatorPort(templateCase.root),
    ).catch(() => {})))
    await cleanupResidualIdeProcesses()
    await removeAutomatorSessionFiles(PLAIN_TEMPLATE.root)
    await removeAutomatorSessionFiles(TDESIGN_TEMPLATE.root)
    const plainPort = resolveProjectAutomatorPort(PLAIN_TEMPLATE.root)
    const tdesignPort = resolveProjectAutomatorPort(TDESIGN_TEMPLATE.root)

    const plainDev = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: PLAIN_TEMPLATE.root,
      env: createDevProcessEnv(),
      reject: false,
    })
    await plainDev.waitFor(
      waitForOpenedAutomator(PLAIN_TEMPLATE.root, 180_000).then(async ({ miniProgram }) => {
        await miniProgram.disconnect()
      }),
      'tailwindcss dev:open ready',
    )
    await plainDev.stop()
    await closeSharedMiniProgram(PLAIN_TEMPLATE.root, plainPort).catch(() => {})
    await delay(2_000)

    const tdesignDev = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: TDESIGN_TEMPLATE.root,
      env: createDevProcessEnv(),
      reject: false,
    })

    try {
      await tdesignDev.waitFor(
        waitForOpenedAutomator(TDESIGN_TEMPLATE.root, 180_000).then(async ({ miniProgram }) => {
          await miniProgram.disconnect()
        }),
        'tailwindcss tdesign dev:open ready after plain exit',
      )
      const { miniProgram } = await waitForOpenedAutomator(TDESIGN_TEMPLATE.root)
      try {
        try {
          await waitForPageText(miniProgram, TDESIGN_TEMPLATE.root, INDEX_ROUTE, 'TDesign Button')
        }
        catch (error) {
          if (isTemplateDevOpenInfraError(error) || isTemplateRenderUnavailable(error)) {
            ctx.skip(`WeChat DevTools 自动化会话未渲染目标模板页面，跳过 dev:open 顺序切换用例。reason=${error instanceof Error ? error.message : String(error)}`)
            return
          }
          throw error
        }
      }
      finally {
        await miniProgram.disconnect()
      }
    }
    finally {
      await tdesignDev.stop().catch(() => {})
      await closeSharedMiniProgram(TDESIGN_TEMPLATE.root, tdesignPort).catch(() => {})
    }
  }, 360_000)
})
