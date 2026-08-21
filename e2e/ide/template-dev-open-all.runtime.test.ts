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
import { attachRuntimeErrorCollector } from './runtimeErrors'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const IDE_AUTOMATOR_INFRA_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+|Timed out waiting for opened automator ws:\/\/127\.0\.0\.1:\d+|无法连接到当前项目的微信开发者工具自动化 websocket|Cannot connect to the Wechat DevTools automation websocket|automation websocket|Connection closed, check if wechat web devTools is still running|WebSocket is not open|socket hang up|Wait timed out after \d+ ms|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/i
const IGNORED_DEVTOOLS_RUNTIME_ERROR_RE = /^\[console:error\] \{"type":"error","args":\[\{\}\]\}$/

interface TemplateCase {
  assertWrapperProject?: boolean
  expectedData?: Record<string, unknown>
  expectedText: string
  name: string
  platform?: string
  projectRoot?: string
  route: string
  root: string
}

const TEMPLATE_CASES: TemplateCase[] = [
  {
    name: 'weapp-vite-plugin-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-plugin-template'),
    route: '/pages/index/index',
    expectedText: '插件能力混合演示',
    assertWrapperProject: true,
    expectedData: {
      pluginAnswer: 42,
    },
  },
  {
    name: 'weapp-vite-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite',
  },
  {
    name: 'weapp-vite-multi-platform-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-multi-platform-template'),
    projectRoot: 'dist/weapp',
    platform: 'weapp',
    route: '/pages/index/index',
    expectedText: '原生多平台 + Web',
    expectedData: {
      platform: 'weapp',
      status: 'ready',
    },
  },
  {
    name: 'weapp-vite-multi-platform-sfc-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-multi-platform-sfc-template'),
    projectRoot: 'dist/weapp',
    platform: 'weapp',
    route: '/pages/index/index',
    expectedText: 'Vue SFC 多平台 + Web',
    expectedData: {
      count: 0,
      doubled: 0,
      platform: 'weapp',
      status: 'ready',
    },
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
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-retail-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'),
    route: '/pages/home/home',
    expectedText: '精选推荐',
  },
]
const TEMPLATE_FILTER = process.env.WEAPP_VITE_E2E_TEMPLATE?.trim()
const ACTIVE_TEMPLATE_CASES = TEMPLATE_FILTER
  ? TEMPLATE_CASES.filter(templateCase => templateCase.name === TEMPLATE_FILTER)
  : TEMPLATE_CASES
const PROTOCOL_TIMEOUT_RECONNECT_THRESHOLD = 3

type TemplateDevProcess = TemplateCase & {
  dev: ReturnType<typeof startDevProcess>
}

function resolveTemplateProjectRoot(templateCase: TemplateCase) {
  return path.resolve(templateCase.root, templateCase.projectRoot ?? '.')
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
    && (
      protocolError.method === 'App.callFunction'
      || protocolError.method === 'App.getCurrentPage'
      || protocolError.method === 'App.getPageStack'
    )
}

function canRetryOnCurrentAutomatorSession(error: unknown) {
  return isDevtoolsProtocolTimeout(error)
    || (error instanceof Error && /timeout waiting for automator response/i.test(error.message))
}

async function removeAutomatorSessionFiles(projectPath: string) {
  await Promise.all([
    fs.rm(resolveAutomatorSessionFile(projectPath), { force: true }).catch(() => {}),
    fs.rm(resolveAutomatorSessionFile(projectPath, resolveProjectAutomatorPort(projectPath)), { force: true }).catch(() => {}),
  ])
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
  let lastProtocolTimeout = ''
  let consecutiveProtocolTimeouts = 0
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
      consecutiveProtocolTimeouts = 0
    }
    catch (error) {
      if (!isDevtoolsProtocolTimeout(error) && !isLikelyRelaunchRetryableError(error)) {
        throw error
      }
      lastProtocolTimeout = error.message
      if (canRetryOnCurrentAutomatorSession(error)) {
        consecutiveProtocolTimeouts += 1
      }
      if (
        canRetryOnCurrentAutomatorSession(error)
        && consecutiveProtocolTimeouts < PROTOCOL_TIMEOUT_RECONNECT_THRESHOLD
      ) {
        await delay(1_000)
        continue
      }
      // 连续短协议超时通常表示 DevTools 会话已经失去响应，重建会话比继续轮询更可靠。
      consecutiveProtocolTimeouts = 0
      await Promise.resolve(currentMiniProgram.disconnect?.()).catch(() => {})
      await closeSharedMiniProgram(projectPath, resolveProjectAutomatorPort(projectPath)).catch(() => {})
      await removeAutomatorSessionFiles(projectPath)
      await delay(1_000)
      currentMiniProgram = (await waitForOpenedAutomator(projectPath, { timeoutMs: 120_000 })).miniProgram
    }
    await delay(1_000)
  }

  const timeoutDetail = lastProtocolTimeout ? `\nLatest DevTools protocol timeout: ${lastProtocolTimeout}` : ''
  throw new Error(`Timed out waiting for rendered text "${text}".${timeoutDetail}\nLatest route: ${latestRoute || '<unknown>'}\nLatest data:\n${latestData || '<empty>'}\nLatest WXML:\n${latestWxml.slice(0, 1000)}`)
}

async function assertPluginTemplateWrapperProject(wrapperProjectPath: string) {
  await expect(JSON.parse(await fs.readFile(path.join(wrapperProjectPath, 'project.config.json'), 'utf8'))).toMatchObject({
    compileType: 'plugin',
    miniprogramRoot: './',
    pluginRoot: 'dist-plugin/',
    srcMiniprogramRoot: './',
    setting: {
      packNpmManually: false,
      packNpmRelationList: [],
    },
  })
  await expect(JSON.parse(await fs.readFile(path.join(wrapperProjectPath, 'app.json'), 'utf8'))).toMatchObject({
    pages: ['pages/index/index'],
    plugins: {
      'hello-plugin': {
        provider: 'wxb3d842a4a7e3440d',
        version: 'dev',
      },
    },
    subPackages: [],
  })
  await expect(fs.access(path.join(wrapperProjectPath, 'pages/index/index.wxml'))).resolves.toBeUndefined()
  await expect(fs.access(path.join(wrapperProjectPath, 'dist-plugin/plugin.json'))).resolves.toBeUndefined()
  await expect(fs.access(path.join(wrapperProjectPath, 'dist-plugin/index.js'))).resolves.toBeUndefined()
}

async function waitForTemplateCaseReady(miniProgram: any, templateCase: TemplateCase, wrapperProjectPath: string) {
  if (templateCase.assertWrapperProject) {
    await assertPluginTemplateWrapperProject(wrapperProjectPath)
    return
  }

  return await waitForPageText(
    miniProgram,
    resolveTemplateProjectRoot(templateCase),
    templateCase.route,
    templateCase.expectedText,
    templateCase.expectedData,
  )
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

  const readySession = waitForOpenedAutomator(resolveTemplateProjectRoot(process), {
    readyRoute: process.route,
    timeoutMs: 120_000,
  }).catch((error) => {
    const details = infraOutput ? `\nRecent infra output:\n${infraOutput}` : ''
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`WeChat DevTools automator unavailable while opening ${process.name}: ${reason}${details}`, {
      cause: error as Error,
    })
  })
  await process.dev.waitFor(
    readySession,
    `${process.name} dev:open ready`,
  )
  return await readySession
}

async function cleanupTemplateAutomatorState(templateCase: TemplateCase) {
  const projectRoot = resolveTemplateProjectRoot(templateCase)
  await Promise.all([
    removeAutomatorSessionFiles(projectRoot),
    fs.rm(resolveAutomatorWrapperProjectPath(projectRoot), { force: true, recursive: true }).catch(() => {}),
  ])
}

function startTemplateDevProcess(templateCase: TemplateCase): TemplateDevProcess {
  const args = ['exec', 'wv', 'dev']
  if (templateCase.platform) {
    args.push('-p', templateCase.platform)
  }
  args.push('-o', '--non-interactive', '--login-retry', 'never')
  return {
    ...templateCase,
    dev: startDevProcess('pnpm', args, {
      cwd: templateCase.root,
      env: createDevProcessEnv(),
      reject: false,
    }),
  }
}

function isTemplateRuntimeInfraError(error: unknown) {
  return error instanceof Error && IDE_AUTOMATOR_INFRA_RE.test(error.message)
}

function isTemplateProtocolTimeout(error: unknown) {
  return error instanceof Error && /Latest DevTools protocol timeout|DevTools did not respond to protocol method/i.test(error.message)
}

async function openTemplateDevProcess(templateCase: TemplateCase) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await cleanupResidualIdeProcesses()
    await cleanupTemplateAutomatorState(templateCase)
    const devProcess = startTemplateDevProcess(templateCase)
    try {
      const session = await waitForTemplateDevOpenReady(devProcess)
      return { devProcess, session }
    }
    catch (error) {
      lastError = error
      await devProcess.dev.stop().catch(() => {})
      const projectRoot = resolveTemplateProjectRoot(templateCase)
      await closeSharedMiniProgram(projectRoot, resolveProjectAutomatorPort(projectRoot)).catch(() => {})
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
    await Promise.all(ACTIVE_TEMPLATE_CASES.map(async templateCase => await cleanupTemplateAutomatorState(templateCase)))
  }, 60_000)

  afterAll(async () => {
    await cleanupTrackedDevProcesses()
    await Promise.all(ACTIVE_TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(
      resolveTemplateProjectRoot(templateCase),
      resolveProjectAutomatorPort(resolveTemplateProjectRoot(templateCase)),
    ).catch(() => {})))
    await cleanupResidualIdeProcesses()
  }, 180_000)

  it.each(ACTIVE_TEMPLATE_CASES)('$name renders after dev:open without runtime errors', async (templateCase) => {
    let lastError: unknown
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const projectRoot = resolveTemplateProjectRoot(templateCase)
      const port = resolveProjectAutomatorPort(projectRoot)
      const { devProcess, session } = await openTemplateDevProcess(templateCase)
      let miniProgram: any
      let runtimeErrors: ReturnType<typeof attachRuntimeErrorCollector> | undefined
      try {
        miniProgram = session.miniProgram
        runtimeErrors = attachRuntimeErrorCollector(miniProgram)
        const runtimeMarker = runtimeErrors.mark()
        const { metadata } = session
        expect(path.resolve(metadata.projectPath)).toBe(projectRoot)
        expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
        const wrapperProjectPath = resolveAutomatorWrapperProjectPath(projectRoot)
        const wrapperProjectConfig = path.join(wrapperProjectPath, 'project.config.json')
        const usesWrapperProject = await fs.access(wrapperProjectConfig).then(() => true).catch(() => false)
        const projectConfigPath = usesWrapperProject
          ? wrapperProjectConfig
          : path.join(projectRoot, 'project.config.json')
        const projectConfig = JSON.parse(await fs.readFile(projectConfigPath, 'utf8'))
        expect(projectConfig).toMatchObject(usesWrapperProject
          ? {
              miniprogramRoot: './',
              srcMiniprogramRoot: './',
            }
          : templateCase.projectRoot
            ? {
                miniprogramRoot: 'dist',
                srcMiniprogramRoot: 'dist',
              }
            : {
                miniprogramRoot: 'dist/',
                srcMiniprogramRoot: 'dist/',
              })

        try {
          await waitForTemplateCaseReady(miniProgram, templateCase, wrapperProjectPath)
        }
        catch (error) {
          throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`)
        }
        expect(runtimeErrors.getSince(runtimeMarker).filter(message => !IGNORED_DEVTOOLS_RUNTIME_ERROR_RE.test(message))).toEqual([])
        expect(runtimeErrors.getAll().filter(message => /DevRuntime|module .* is not defined|SystemError|MiniProgramError/i.test(message))).toEqual([])
        return
      }
      catch (error) {
        lastError = error
        const canRetry = isTemplateRuntimeInfraError(error) || isTemplateProtocolTimeout(error)
        if (attempt >= 2 || !canRetry) {
          throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`)
        }
        process.stdout.write(`[warn] [template-dev-open-all] retry runtime template=${templateCase.name} reason=${error instanceof Error ? error.message : String(error)}\n`)
      }
      finally {
        runtimeErrors?.dispose()
        try {
          miniProgram?.disconnect?.()
        }
        catch {}
        await devProcess.dev.stop().catch(() => {})
        await closeSharedMiniProgram(
          projectRoot,
          port,
        ).catch(() => {})
        await cleanupResidualIdeProcesses()
        await delay(2_000)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }, 480_000)
})
