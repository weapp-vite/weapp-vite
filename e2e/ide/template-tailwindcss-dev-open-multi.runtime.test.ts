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
import { isLikelyRelaunchRetryableError } from '../utils/automator'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'

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
    expectedText: 'Hello weapp-vite + Vant',
    name: 'tailwindcss-vant',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-vant-template'),
    tdesign: false,
  },
  {
    expectedText: 'Hello weapp-vite + TDesign',
    name: 'tailwindcss-tdesign',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template'),
    tdesign: true,
  },
] as const
const PLAIN_TEMPLATE = TEMPLATE_CASES[0]
const TDESIGN_TEMPLATE = TEMPLATE_CASES[2]
const IDE_AUTOMATOR_INFRA_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+|Timed out waiting for opened automator ws:\/\/127\.0\.0\.1:\d+|无法连接到当前项目的微信开发者工具自动化 websocket|Cannot connect to the Wechat DevTools automation websocket|automation websocket|Connection closed, check if wechat web devTools is still running|WebSocket is not open|socket hang up|Wait timed out after \d+ ms|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/i

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

function isDevtoolsProtocolTimeout(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const protocolError = error as Error & { code?: unknown, method?: unknown }
  return protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && (
      protocolError.method === 'App.getCurrentPage'
      || protocolError.method === 'App.getPageStack'
      || protocolError.method === 'App.callFunction'
    )
}

async function removeAutomatorSessionFiles(projectPath: string) {
  await Promise.all([
    fs.rm(resolveAutomatorSessionFile(projectPath), { force: true }).catch(() => {}),
    fs.rm(resolveAutomatorSessionFile(projectPath, resolveProjectAutomatorPort(projectPath)), { force: true }).catch(() => {}),
  ])
}

async function waitForPageText(miniProgram: any, projectPath: string, route: string, text: string, timeoutMs = 90_000) {
  const normalizedRoute = normalizeRoutePath(route)
  const start = Date.now()
  let latestWxml = ''
  let emptyPageReads = 0
  let lastProtocolTimeout = ''
  let currentMiniProgram = miniProgram

  while (Date.now() - start <= timeoutMs) {
    try {
      const currentPage = await currentMiniProgram.currentPage?.()
      const page = normalizeRoutePath(String(currentPage?.path ?? '')) === normalizedRoute
        ? currentPage
        : await currentMiniProgram.reLaunch(route)
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
        if (valueContainsText(data, text)) {
          return JSON.stringify(data)
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
      if (!isDevtoolsProtocolTimeout(error) && !isLikelyRelaunchRetryableError(error)) {
        throw error
      }
      lastProtocolTimeout = error.message
      currentMiniProgram.disconnect?.()
      currentMiniProgram = (await waitForOpenedAutomator(projectPath, { timeoutMs: 30_000 })).miniProgram
    }
    await delay(1_000)
  }

  const timeoutDetail = lastProtocolTimeout ? `\nLatest DevTools protocol timeout: ${lastProtocolTimeout}` : ''
  throw new Error(`Timed out waiting for rendered text "${text}".${timeoutDetail}\nLatest WXML:\n${latestWxml.slice(0, 1000)}`)
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

function startTemplateDevProcess(templateCase: typeof TEMPLATE_CASES[number]): TemplateDevProcess {
  return {
    ...templateCase,
    dev: startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: templateCase.root,
      env: createDevProcessEnv(),
      reject: false,
    }),
  }
}

describe.sequential('template TailwindCSS dev:open multi-project IDE integration', () => {
  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await removeAutomatorSessionFiles(templateCase.root)))
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await fs.rm(resolveAutomatorWrapperProjectPath(templateCase.root), { force: true, recursive: true }).catch(() => {})))
  }, 60_000)

  afterAll(async () => {
    await cleanupTrackedDevProcesses()
    await Promise.all(TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(templateCase.root).catch(() => {})))
    await cleanupResidualIdeProcesses()
  }, 60_000)

  it('renders each real template root after dev:open', async () => {
    for (const templateCase of TEMPLATE_CASES) {
      const process = startTemplateDevProcess(templateCase)
      const port = resolveProjectAutomatorPort(templateCase.root)
      try {
        await waitForTemplateDevOpenReady(process)
        const { metadata, miniProgram } = await waitForOpenedAutomator(templateCase.root)
        try {
          expect(path.resolve(metadata.projectPath)).toBe(templateCase.root)
          expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
          const wrapperProjectPath = resolveAutomatorWrapperProjectPath(templateCase.root)
          await fs.access(wrapperProjectPath)
          expect(JSON.parse(await fs.readFile(path.join(wrapperProjectPath, 'project.config.json'), 'utf8'))).toMatchObject({
            miniprogramRoot: './',
            srcMiniprogramRoot: './',
          })
          await waitForPageText(miniProgram, templateCase.root, INDEX_ROUTE, templateCase.expectedText)
        }
        finally {
          miniProgram.disconnect?.()
        }
      }
      finally {
        await process.dev.stop().catch(() => {})
        await closeSharedMiniProgram(templateCase.root, port).catch(() => {})
        await removeAutomatorSessionFiles(templateCase.root)
        await delay(1_000)
      }
    }
  }, 480_000)

  it('opens the next template after the previous dev:open process exits', async () => {
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
    try {
      await waitForTemplateDevOpenReady({ ...PLAIN_TEMPLATE, dev: plainDev })
    }
    catch (error) {
      await plainDev.stop().catch(() => {})
      throw error
    }
    await plainDev.stop()
    await closeSharedMiniProgram(PLAIN_TEMPLATE.root, plainPort).catch(() => {})
    await delay(2_000)

    const tdesignDev = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: TDESIGN_TEMPLATE.root,
      env: createDevProcessEnv(),
      reject: false,
    })

    try {
      await waitForTemplateDevOpenReady({ ...TDESIGN_TEMPLATE, dev: tdesignDev })
      const { miniProgram } = await waitForOpenedAutomator(TDESIGN_TEMPLATE.root)
      try {
        await waitForPageText(miniProgram, TDESIGN_TEMPLATE.root, INDEX_ROUTE, TDESIGN_TEMPLATE.expectedText)
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
