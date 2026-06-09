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
  takeScreenshot,
} from 'weapp-ide-cli'
import { registerRuntimeTools } from '../../packages/mcp/src/server/runtime'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const READY_OUTPUT_RE = /mini initial build completed|开发快捷键已就绪|✔ open/
const HMR_SUFFIX = 'IDE_ALL_HMR'

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
    route: '/pages/home/home',
    sourcePath: 'src/pages/home/home.vue',
    expectedText: 'iphone 13 火热发售中',
    hmrText: `iphone 13 火热发售中 ${HMR_SUFFIX}`,
  },
]

const originalSources = new Map<string, string>()

function resolveAutomatorSessionFile(projectPath: string) {
  const encodedProjectPath = Buffer.from(path.resolve(projectPath)).toString('base64url')
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

async function waitForOpenedAutomator(projectPath: string, timeoutMs = 120_000) {
  const start = Date.now()
  let lastError: unknown

  while (Date.now() - start <= timeoutMs) {
    try {
      const raw = await fs.readFile(resolveAutomatorSessionFile(projectPath), 'utf8')
      const metadata = JSON.parse(raw) as Partial<AutomatorSessionMetadata>
      if (path.resolve(metadata.projectPath ?? '') !== projectPath) {
        throw new Error(`opened automator metadata project mismatch: ${JSON.stringify(metadata)}`)
      }
      if (typeof metadata.wsEndpoint !== 'string' || !/^ws:\/\/127\.0\.0\.1:\d+$/.test(metadata.wsEndpoint)) {
        throw new Error(`opened automator endpoint missing: ${JSON.stringify(metadata)}`)
      }

      const miniProgram = await connectOpenedAutomator({
        projectPath,
        timeout: 30_000,
      })
      return {
        metadata: metadata as AutomatorSessionMetadata,
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

async function waitForPageText(miniProgram: any, route: string, text: string, timeoutMs = 90_000) {
  const start = Date.now()
  let latestWxml = ''

  while (Date.now() - start <= timeoutMs) {
    const page = await miniProgram.reLaunch(route)
    await page.waitFor(500)
    const root = await page.$('page')
    latestWxml = root ? await root.outerWxml() : ''
    if (latestWxml.includes(text)) {
      return latestWxml
    }
    await delay(1_000)
  }

  throw new Error(`Timed out waiting for rendered text "${text}". Latest WXML:\n${latestWxml.slice(0, 1000)}`)
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

async function restoreSources() {
  for (const [filePath, source] of originalSources) {
    await fs.writeFile(filePath, source, 'utf8').catch(() => {})
  }
  originalSources.clear()
}

describe.sequential('all templates dev:open IDE integration', () => {
  beforeAll(async () => {
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(resolveAutomatorSessionFile(templateCase.root), { force: true }).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(resolveAutomatorWrapperProjectPath(templateCase.root), { force: true, recursive: true }).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.join(templateCase.root, '.tmp/dev-open-all.png'), { force: true }).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.resolve(WORKSPACE_ROOT, 'templates', path.basename(templateCase.root), '.tmp/dev-open-all-mcp.png'), { force: true }).catch(() => {})))
  }, 60_000)

  afterAll(async () => {
    await restoreSources()
    await cleanupTrackedDevProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(templateCase.root).catch(() => {})))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(path.join(templateCase.root, '.tmp/dev-open-all.png'), { force: true }).catch(() => {})))
  }, 60_000)

  it('keeps HMR, screenshot, and MCP connected for every runnable app template after concurrent dev:open', async () => {
    const processes = TEMPLATE_CASES.map(templateCase => ({
      ...templateCase,
      dev: startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
        cwd: templateCase.root,
        env: createDevProcessEnv(),
        reject: false,
      }),
    }))

    try {
      await Promise.all(processes.map(async item => await item.dev.waitForOutput(READY_OUTPUT_RE, `${item.name} dev:open ready`, 240_000)))

      const runtimeTools = await createRuntimeTools()
      try {
        for (const templateCase of TEMPLATE_CASES) {
          const { metadata, miniProgram } = await waitForOpenedAutomator(templateCase.root)
          expect(path.resolve(metadata.projectPath)).toBe(templateCase.root)
          expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
          await expect(fs.access(resolveAutomatorWrapperProjectPath(templateCase.root))).rejects.toThrow()

          await waitForPageText(miniProgram, templateCase.route, templateCase.expectedText)
          await patchSourceText(templateCase)
          await waitForPageText(miniProgram, templateCase.route, templateCase.hmrText)

          const screenshotPath = path.join(templateCase.root, '.tmp/dev-open-all.png')
          const screenshot = await takeScreenshot({
            outputPath: screenshotPath,
            preserveProjectRoot: true,
            projectPath: templateCase.root,
            sharedSession: true,
            timeout: 60_000,
          })
          expect(screenshot.path).toBe(screenshotPath)
          expect((await fs.stat(screenshotPath)).size).toBeGreaterThan(0)

          const connectResult = await getTool(runtimeTools.tools, 'weapp_devtools_connect')({
            preserveProjectRoot: true,
            projectPath: templateCase.root,
            timeout: 60_000,
          })
          expect(expectToolResult<{ connected: boolean, resolvedProjectPath: string }>(connectResult)).toMatchObject({
            connected: true,
            resolvedProjectPath: templateCase.root,
          })

          const capturePath = path.join('templates', path.basename(templateCase.root), '.tmp/dev-open-all-mcp.png')
          const captureResult = await getTool(runtimeTools.tools, 'weapp_devtools_capture')({
            outputPath: capturePath,
            preserveProjectRoot: true,
            projectPath: templateCase.root,
            timeout: 60_000,
          })
          const capture = expectToolResult<{ bytes: number, path: string }>(captureResult)
          expect(capture.bytes).toBeGreaterThan(0)
          expect(path.resolve(capture.path)).toBe(path.resolve(WORKSPACE_ROOT, capturePath))

          await miniProgram.disconnect()
        }
      }
      finally {
        await restoreSources()
        await Promise.all(TEMPLATE_CASES.map(async templateCase => await runtimeTools.manager.close({ projectPath: templateCase.root }).catch(() => {})))
      }
    }
    finally {
      await Promise.all(processes.map(async item => await item.dev.stop().catch(() => {})))
    }
  }, 900_000)
})
