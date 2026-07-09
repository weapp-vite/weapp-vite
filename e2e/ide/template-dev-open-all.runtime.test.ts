import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  resolveProjectAutomatorPort,
} from 'weapp-ide-cli'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const IDE_AUTOMATOR_INFRA_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+|Timed out waiting for opened automator ws:\/\/127\.0\.0\.1:\d+|无法连接到当前项目的微信开发者工具自动化 websocket|Cannot connect to the Wechat DevTools automation websocket|automation websocket|Wait timed out after \d+ ms|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/i

interface TemplateCase {
  expectedData?: Record<string, unknown>
  expectedText: string
  name: string
  route: string
  root: string
}

const TEMPLATE_CASES: TemplateCase[] = [
  {
    name: 'weapp-vite-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite',
  },
  {
    name: 'weapp-vite-lib-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-lib-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite lib',
  },
  {
    name: 'weapp-vite-tailwindcss-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite',
  },
  {
    name: 'weapp-vite-tailwindcss-tdesign-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite + TDesign',
  },
  {
    name: 'weapp-vite-tailwindcss-vant-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-vant-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite + Vant',
  },
  {
    name: 'weapp-vite-wevu-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-template'),
    route: '/pages/index/index',
    expectedText: 'Weapp-vite + Wevu',
    expectedData: {
      count: 0,
      doubled: 0,
    },
  },
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template'),
    route: '/pages/index/index',
    expectedText: 'TDesign 最小模板',
    expectedData: {
      count: 0,
    },
  },
]

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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeRoutePath(routePath: string) {
  return routePath.split('?', 1)[0].split('#', 1)[0].replace(/^\/+/, '').replace(/\/+$/g, '')
}

function valueContainsText(value: unknown, text: string) {
  if (typeof value === 'string') {
    return value.includes(text)
  }
  if (Array.isArray(value)) {
    return value.some(item => valueContainsText(item, text))
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(item => valueContainsText(item, text))
  }
  return false
}

function dataMatchesExpected(data: unknown, expected: Record<string, unknown> | undefined) {
  if (!expected) {
    return false
  }
  if (!data || typeof data !== 'object') {
    return false
  }
  const record = data as Record<string, unknown>
  return Object.entries(expected).every(([key, value]) => record[key] === value)
}

function isDevtoolsProtocolTimeout(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const protocolError = error as Error & { code?: unknown, method?: unknown }
  return protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && (protocolError.method === 'App.getCurrentPage' || protocolError.method === 'App.getPageStack')
}

async function waitForPageText(miniProgram: any, projectPath: string, route: string, text: string, expectedData?: Record<string, unknown>, timeoutMs = 90_000) {
  if (!route) {
    throw new Error(`Missing route while waiting for rendered text "${text}"`)
  }
  const normalizedRoute = normalizeRoutePath(route)
  const start = Date.now()
  let latestWxml = ''
  let latestData = ''
  let latestRoute = ''
  let emptyPageReads = 0
  let lastProtocolTimeout = ''
  let currentMiniProgram = miniProgram

  while (Date.now() - start <= timeoutMs) {
    try {
      const currentPage = await currentMiniProgram.currentPage?.()
      latestRoute = String(currentPage?.path ?? '')
      const page = normalizeRoutePath(String(currentPage?.path ?? '')) === normalizedRoute
        ? currentPage
        : await currentMiniProgram.reLaunch(route)
      latestRoute = String(page?.path ?? latestRoute)
      await page.waitFor(500)
      try {
        latestWxml = await page.waitForRendered({
          text,
          timeout: Math.min(5_000, Math.max(1, timeoutMs - (Date.now() - start))),
        })
        return latestWxml
      }
      catch {
        // 继续读取 WXML，保留更具体的失败上下文。
      }
      const root = await page.$('page')
      latestWxml = root ? await root.outerWxml() : ''
      if (latestWxml.includes(text)) {
        return latestWxml
      }
      try {
        const data = await page.data(undefined, {
          routeOnly: true,
          timeout: 3_000,
        })
        latestData = JSON.stringify(data).slice(0, 1000)
        if (valueContainsText(data, text) || dataMatchesExpected(data, expectedData)) {
          return latestData
        }
      }
      catch {
        // Page 域 DOM 不稳定时，data fallback 也可能短暂不可读，继续轮询。
      }
      if (latestWxml.trim() === '' || latestWxml.trim() === '<page></page>') {
        emptyPageReads += 1
        if (emptyPageReads >= 2) {
          currentMiniProgram.disconnect?.()
          currentMiniProgram = (await waitForOpenedAutomator(projectPath, { timeoutMs: 30_000 })).miniProgram
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
      currentMiniProgram = (await waitForOpenedAutomator(projectPath, { timeoutMs: 30_000 })).miniProgram
    }
    await delay(1_000)
  }

  const timeoutDetail = lastProtocolTimeout ? `\nLatest DevTools protocol timeout: ${lastProtocolTimeout}` : ''
  throw new Error(`Timed out waiting for rendered text "${text}".${timeoutDetail}\nLatest route: ${latestRoute || '<unknown>'}\nLatest data:\n${latestData || '<empty>'}\nLatest WXML:\n${latestWxml.slice(0, 1000)}`)
}

async function waitForTemplateDevOpenReady(process: TemplateDevProcess) {
  let infraOutput = ''
  void process.dev.waitForOutput(
    IDE_AUTOMATOR_INFRA_RE,
    `${process.name} dev:open automator early infra notice`,
    75_000,
  ).then((output) => {
    infraOutput = output.length > 4_000 ? output.slice(-4_000) : output
  }).catch(() => {})

  await process.dev.waitFor(
    waitForOpenedAutomator(process.root, { timeoutMs: 120_000 }).then(async ({ miniProgram }) => {
      await miniProgram.disconnect()
    }).catch((error) => {
      const details = infraOutput ? `\nRecent infra output:\n${infraOutput}` : ''
      throw new Error(`WeChat DevTools automator unavailable while opening ${process.name}${details}`, {
        cause: error as Error,
      })
    }),
    `${process.name} dev:open ready`,
  )
}

async function cleanupTemplateAutomatorState(templateCase: TemplateCase) {
  await Promise.all([
    fs.rm(resolveAutomatorSessionFile(templateCase.root), { force: true }).catch(() => {}),
    fs.rm(resolveAutomatorSessionFile(templateCase.root, resolveProjectAutomatorPort(templateCase.root)), { force: true }).catch(() => {}),
    fs.rm(resolveAutomatorWrapperProjectPath(templateCase.root), { force: true, recursive: true }).catch(() => {}),
  ])
}

function startTemplateDevProcess(templateCase: TemplateCase): TemplateDevProcess {
  return {
    ...templateCase,
    dev: startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: templateCase.root,
      env: createDevProcessEnv(),
      reject: false,
    }),
  }
}

async function openTemplateDevProcess(templateCase: TemplateCase) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await cleanupResidualIdeProcesses()
    await cleanupTemplateAutomatorState(templateCase)
    const devProcess = startTemplateDevProcess(templateCase)
    try {
      await waitForTemplateDevOpenReady(devProcess)
      return devProcess
    }
    catch (error) {
      lastError = error
      await devProcess.dev.stop().catch(() => {})
      await closeSharedMiniProgram(templateCase.root, resolveProjectAutomatorPort(templateCase.root)).catch(() => {})
      await cleanupResidualIdeProcesses()
      if (attempt < 2) {
        process.stdout.write(`[warn] [template-dev-open-all] retry dev:open template=${templateCase.name} reason=${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

describe.sequential('all templates dev:open IDE integration', () => {
  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await cleanupTemplateAutomatorState(templateCase)))
  }, 60_000)

  afterAll(async () => {
    await cleanupTrackedDevProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(
      templateCase.root,
      resolveProjectAutomatorPort(templateCase.root),
    ).catch(() => {})))
    await cleanupResidualIdeProcesses()
  }, 180_000)

  it('renders every app template after dev:open', async () => {
    for (const templateCase of TEMPLATE_CASES) {
      const port = resolveProjectAutomatorPort(templateCase.root)
      const devProcess = await openTemplateDevProcess(templateCase)
      let miniProgram: any
      try {
        const session = await waitForOpenedAutomator(templateCase.root)
        miniProgram = session.miniProgram
        const { metadata } = session
        expect(path.resolve(metadata.projectPath)).toBe(templateCase.root)
        expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
        const wrapperProjectPath = resolveAutomatorWrapperProjectPath(templateCase.root)
        await fs.access(wrapperProjectPath)
        expect(JSON.parse(await fs.readFile(path.join(wrapperProjectPath, 'project.config.json'), 'utf8'))).toMatchObject({
          miniprogramRoot: './',
          srcMiniprogramRoot: './',
        })

        try {
          await waitForPageText(miniProgram, templateCase.root, templateCase.route, templateCase.expectedText, templateCase.expectedData)
        }
        catch (error) {
          throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      catch (error) {
        throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`)
      }
      finally {
        try {
          miniProgram?.disconnect?.()
        }
        catch {}
        await devProcess.dev.stop().catch(() => {})
        await closeSharedMiniProgram(
          templateCase.root,
          port,
        ).catch(() => {})
        await cleanupResidualIdeProcesses()
        await delay(2_000)
      }
    }
  }, 900_000)
})
