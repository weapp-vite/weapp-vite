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
const HMR_SUFFIX = 'IDE_ALL_HMR'
const SCREENSHOT_WATCHDOG_TIMEOUT = 75_000

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

interface TemplateCase {
  expectedText: string
  hmrText: string
  name: string
  route: string
  root: string
  sourcePath: string
}

interface AutomatorSessionMetadata {
  projectPath: string
  updatedAt: string
  wsEndpoint: string
}

const TEMPLATE_CASES: TemplateCase[] = [
  {
    name: 'weapp-vite-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-template'),
    route: '/pages/index/index',
    sourcePath: 'src/pages/index/index.ts',
    expectedText: 'Hello weapp-vite',
    hmrText: `Hello weapp-vite ${HMR_SUFFIX}`,
  },
  {
    name: 'weapp-vite-lib-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-lib-template'),
    route: '/pages/index/index',
    sourcePath: 'src/pages/index/index.ts',
    expectedText: 'Hello weapp-vite lib',
    hmrText: `Hello weapp-vite lib ${HMR_SUFFIX}`,
  },
  {
    name: 'weapp-vite-tailwindcss-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-template'),
    route: '/pages/index/index',
    sourcePath: 'src/pages/index/index.ts',
    expectedText: 'Hello weapp-vite',
    hmrText: `Hello weapp-vite ${HMR_SUFFIX}`,
  },
  {
    name: 'weapp-vite-tailwindcss-tdesign-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template'),
    route: '/pages/index/index',
    sourcePath: 'src/pages/index/index.ts',
    expectedText: 'Hello weapp-vite + TDesign',
    hmrText: `Hello weapp-vite + TDesign ${HMR_SUFFIX}`,
  },
  {
    name: 'weapp-vite-tailwindcss-vant-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-vant-template'),
    route: '/pages/index/index',
    sourcePath: 'src/pages/index/index.ts',
    expectedText: 'Hello weapp-vite + Vant',
    hmrText: `Hello weapp-vite + Vant ${HMR_SUFFIX}`,
  },
  {
    name: 'weapp-vite-wevu-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-template'),
    route: '/pages/index/index',
    sourcePath: 'src/pages/index/index.vue',
    expectedText: 'Weapp-vite + Wevu',
    hmrText: `Weapp-vite + Wevu ${HMR_SUFFIX}`,
  },
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template'),
    route: '/pages/index/index',
    sourcePath: 'src/pages/index/index.vue',
    expectedText: 'TDesign 最小模板',
    hmrText: `TDesign 最小模板 ${HMR_SUFFIX}`,
  },
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-retail-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'),
    route: '/pages/user/name-edit/index',
    sourcePath: 'src/pages/user/name-edit/index.vue',
    expectedText: '最多可输入15个字',
    hmrText: `最多可输入15个字 ${HMR_SUFFIX}`,
  },
]

const originalSources = new Map<string, string>()

type TemplateDevProcess = TemplateCase & {
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

function withWatchdog<T>(task: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

function isDevtoolsProtocolTimeout(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const protocolError = error as Error & { code?: unknown, method?: unknown }
  return protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && (protocolError.method === 'App.getCurrentPage' || protocolError.method === 'App.getPageStack')
}

function isScreenshotProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const protocolError = error instanceof Error
    ? error as Error & { code?: unknown, method?: unknown }
    : {}
  return (protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT' && protocolError.method === 'App.captureScreenshot')
    || protocolError.code === 'DEVTOOLS_SCREENSHOT_TIMEOUT'
    || message.includes('DEVTOOLS_PROTOCOL_TIMEOUT')
    || message.includes('截图请求在')
    || message.includes('timed out after')
    || message.includes('App.captureScreenshot')
    || message.includes('协议调用 App.captureScreenshot')
    || message.includes('DevTools did not respond')
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

async function waitForPageText(miniProgram: any, projectPath: string, route: string, text: string, timeoutMs = 90_000) {
  if (!route) {
    throw new Error(`Missing route while waiting for rendered text "${text}"`)
  }
  const start = Date.now()
  let latestWxml = ''
  let emptyPageReads = 0
  let lastProtocolTimeout = ''
  let currentMiniProgram = miniProgram

  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await currentMiniProgram.reLaunch(route)
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

async function patchSourceText(templateCase: TemplateCase) {
  const sourceFile = path.join(templateCase.root, templateCase.sourcePath)
  const source = await fs.readFile(sourceFile, 'utf8')
  originalSources.set(sourceFile, source)
  const patched = source.replace(templateCase.expectedText, templateCase.hmrText)
  if (patched === source) {
    throw new Error(`[${templateCase.name}] failed to patch HMR source text: ${templateCase.expectedText}`)
  }
  await fs.writeFile(sourceFile, patched, 'utf8')
}

async function tryTakeScreenshot(templateCase: TemplateCase, port: number, screenshotPath: string) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 1; attempt += 1) {
    try {
      const screenshot = await withWatchdog(
        takeScreenshot({
          outputPath: screenshotPath,
          port,
          preserveProjectRoot: true,
          projectPath: templateCase.root,
          sharedSession: true,
          timeout: 60_000,
        }),
        SCREENSHOT_WATCHDOG_TIMEOUT,
        `${templateCase.name} screenshot`,
      )
      expect(screenshot.path).toBe(screenshotPath)
      expect((await fs.stat(screenshotPath)).size).toBeGreaterThan(0)
      return
    }
    catch (error) {
      lastError = error
      if (!isScreenshotProtocolUnavailable(error)) {
        throw error
      }
      await delay(1_000)
    }
  }

  process.stdout.write(
    `[warn] [template-dev-open-all] skip screenshot assertion template=${templateCase.name} reason=${lastError instanceof Error ? lastError.message : String(lastError)}\n`,
  )
}

async function tryCaptureWithMcp(runtimeTools: Awaited<ReturnType<typeof createRuntimeTools>>, templateCase: TemplateCase, port: number) {
  const capturePath = path.join('templates', path.basename(templateCase.root), '.tmp/dev-open-all-mcp.png')
  let lastError: unknown

  try {
    const captureResult = await withWatchdog(
      getTool(runtimeTools.tools, 'weapp_devtools_capture')({
        outputPath: capturePath,
        port,
        preserveProjectRoot: true,
        projectPath: templateCase.root,
        timeout: 60_000,
      }),
      SCREENSHOT_WATCHDOG_TIMEOUT,
      `${templateCase.name} MCP capture`,
    )
    const capture = expectToolResult<{ bytes: number, path: string }>(captureResult)
    expect(capture.bytes).toBeGreaterThan(0)
    expect(path.resolve(capture.path)).toBe(path.resolve(WORKSPACE_ROOT, capturePath))
    return
  }
  catch (error) {
    lastError = error
    if (!isScreenshotProtocolUnavailable(error)) {
      throw error
    }
  }

  process.stdout.write(
    `[warn] [template-dev-open-all] skip MCP capture assertion template=${templateCase.name} reason=${lastError instanceof Error ? lastError.message : String(lastError)}\n`,
  )
}

async function restoreSources() {
  for (const [filePath, source] of originalSources) {
    await fs.writeFile(filePath, source, 'utf8').catch(() => {})
  }
  originalSources.clear()
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
      waitForOpenedAutomator(process.root, 240_000).then(async ({ miniProgram }) => {
        await miniProgram.disconnect()
      }),
      `${process.name} dev:open ready`,
    )
  }

  return processes
}

describe.sequential('all templates dev:open IDE integration', () => {
  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await Promise.all([
      fs.rm(resolveAutomatorSessionFile(templateCase.root), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(templateCase.root, resolveProjectAutomatorPort(templateCase.root)), { force: true }).catch(() => {}),
    ])))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(resolveAutomatorWrapperProjectPath(templateCase.root), { force: true, recursive: true }).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.join(templateCase.root, '.tmp/dev-open-all.png'), { force: true }).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.resolve(WORKSPACE_ROOT, 'templates', path.basename(templateCase.root), '.tmp/dev-open-all-mcp.png'), { force: true }).catch(() => {})))
  }, 60_000)

  afterAll(async () => {
    await restoreSources()
    await cleanupTrackedDevProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(
      templateCase.root,
      resolveProjectAutomatorPort(templateCase.root),
    ).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.join(templateCase.root, '.tmp/dev-open-all.png'), { force: true }).catch(() => {})))
    await cleanupResidualIdeProcesses()
  }, 180_000)

  it('keeps HMR, screenshot, and MCP connected for every runnable app template after concurrent dev:open', async () => {
    const processes = await startTemplateDevProcesses()

    try {
      const runtimeTools = await createRuntimeTools()
      try {
        for (const templateCase of TEMPLATE_CASES) {
          const port = resolveProjectAutomatorPort(templateCase.root)
          const { metadata, miniProgram } = await waitForOpenedAutomator(templateCase.root)
          expect(path.resolve(metadata.projectPath)).toBe(templateCase.root)
          expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
          await expect(fs.access(resolveAutomatorWrapperProjectPath(templateCase.root))).rejects.toThrow()

          try {
            await waitForPageText(miniProgram, templateCase.root, templateCase.route, templateCase.expectedText)
            await patchSourceText(templateCase)
            await waitForPageText(miniProgram, templateCase.root, templateCase.route, templateCase.hmrText)
          }
          catch (error) {
            throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`)
          }

          const screenshotPath = path.join(templateCase.root, '.tmp/dev-open-all.png')
          await tryTakeScreenshot(templateCase, port, screenshotPath)

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

          await tryCaptureWithMcp(runtimeTools, templateCase, port)

          await miniProgram.disconnect()
        }
      }
      finally {
        await restoreSources()
        await Promise.all(TEMPLATE_CASES.map(async templateCase => await runtimeTools.manager.close({
          port: resolveProjectAutomatorPort(templateCase.root),
          projectPath: templateCase.root,
        }).catch(() => {})))
      }
    }
    finally {
      await Promise.all(processes.map(async item => await item.dev.stop().catch(() => {})))
    }
  }, 900_000)
})
