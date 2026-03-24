import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

interface RuntimeRouteCase {
  route: string
  readyText: string
  expectedTokens: string[]
}

interface RuntimeMatrixCase {
  id: string
  env: Record<string, string>
  routes: RuntimeRouteCase[]
}

const baseRoutes: RuntimeRouteCase[] = [
  {
    route: '/pages/index/index',
    readyText: 'shared chunk modes',
    expectedTokens: ['__COMMON_MARKER__', '__PATH_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
  {
    route: '/packageA/pages/foo',
    readyText: 'chunk modes packageA',
    expectedTokens: ['__COMMON_MARKER__', '__SUB_ONLY_MARKER__', '__PATH_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
  {
    route: '/packageB/pages/bar',
    readyText: 'chunk modes packageB',
    expectedTokens: ['__COMMON_MARKER__', '__SUB_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
]

const runtimeCases: RuntimeMatrixCase[] = [
  { id: 'duplicate-common-preserve', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'common', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'hoist-common-preserve', env: { WEAPP_CHUNK_STRATEGY: 'hoist', WEAPP_CHUNK_MODE: 'common', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'duplicate-path-preserve', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'hoist-path-preserve', env: { WEAPP_CHUNK_STRATEGY: 'hoist', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'duplicate-inline-preserve', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'inline', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'hoist-inline-preserve', env: { WEAPP_CHUNK_STRATEGY: 'hoist', WEAPP_CHUNK_MODE: 'inline', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'duplicate-common-mixed-inline', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'common', WEAPP_CHUNK_DYNAMIC: 'inline', WEAPP_CHUNK_OVERRIDE: 'mixed' }, routes: baseRoutes },
  { id: 'duplicate-path-shared-root', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none', WEAPP_CHUNK_SHARED_PATH_ROOT: 'shared' }, routes: baseRoutes },
  { id: 'duplicate-path-invalid-root', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none', WEAPP_CHUNK_SHARED_PATH_ROOT: 'invalid' }, routes: baseRoutes },
]

let sharedMiniProgram: any = null
let sharedLaunchInfraUnavailableMessage: string | null = null

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(/^\/+/, '')
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function waitForPageWxml(page: any, readyText?: string, timeoutMs = 15_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const wxml = await readPageWxml(page)
      const normalized = wxml.trim()
      if (readyText) {
        if (normalized.includes(readyText)) {
          return true
        }
      }
      else if (normalized && normalized !== '<text></text>') {
        return true
      }
    }
    catch {
      // 页面切换瞬态下 DOM 可能短暂不可读，继续轮询。
    }

    if (typeof page?.waitFor === 'function') {
      try {
        await page.waitFor(220)
        continue
      }
      catch {
        // page 对象短暂失效时退回普通 sleep。
      }
    }
    await delay(220)
  }
  return false
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      if (normalizeRoutePath(page?.path ?? '') === normalizedExpectedPath) {
        return page
      }
    }
    catch {
      // 页面切换时 currentPage 可能短暂失败，继续轮询。
    }
    await delay(220)
  }
  return null
}

async function relaunchPage(miniProgram: any, route: string, readyText?: string, timeoutMs = 15_000) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let page: any = null
    try {
      page = await miniProgram.reLaunch(route)
    }
    catch {
      await delay(280)
      continue
    }
    if (!page) {
      await delay(220)
      continue
    }

    const currentPage = await waitForCurrentPagePath(miniProgram, route, timeoutMs)
    const targetPage = currentPage ?? page
    const ready = await waitForPageWxml(targetPage, readyText, timeoutMs)
    if (ready) {
      return targetPage
    }
    await delay(220)
  }

  return null
}

async function runBuild(runtimeCase: RuntimeMatrixCase) {
  await fs.remove(DIST_ROOT)

  const previousEnv: Record<string, string | undefined> = {
    WEAPP_CHUNK_STRATEGY: process.env.WEAPP_CHUNK_STRATEGY,
    WEAPP_CHUNK_MODE: process.env.WEAPP_CHUNK_MODE,
    WEAPP_CHUNK_DYNAMIC: process.env.WEAPP_CHUNK_DYNAMIC,
    WEAPP_CHUNK_OVERRIDE: process.env.WEAPP_CHUNK_OVERRIDE,
    WEAPP_CHUNK_SHARED_PATH_ROOT: process.env.WEAPP_CHUNK_SHARED_PATH_ROOT,
    WEAPP_CHUNK_OUTDIR: process.env.WEAPP_CHUNK_OUTDIR,
  }

  Object.assign(process.env, runtimeCase.env, {
    WEAPP_CHUNK_OUTDIR: 'dist',
  })

  try {
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: `ide:chunk-modes:${runtimeCase.id}`,
      skipNpm: true,
    })
  }
  finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
  }
}

async function getSharedMiniProgram(ctx?: { skip: (message?: string) => void }) {
  if (sharedLaunchInfraUnavailableMessage) {
    ctx?.skip(sharedLaunchInfraUnavailableMessage)
    throw new Error(sharedLaunchInfraUnavailableMessage)
  }

  if (!sharedMiniProgram) {
    try {
      sharedMiniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
    }
    catch (error) {
      if (ctx && isDevtoolsHttpPortError(error)) {
        sharedLaunchInfraUnavailableMessage = 'WeChat DevTools 基础设施不可用，跳过 chunk-modes IDE 自动化用例。'
        ctx.skip(sharedLaunchInfraUnavailableMessage)
      }
      throw error
    }
  }

  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('e2e app: chunk-modes runtime matrix', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  for (const runtimeCase of runtimeCases) {
    it(`runs without runtime errors in devtools for ${runtimeCase.id}`, async (ctx) => {
      await closeSharedMiniProgram()
      await runBuild(runtimeCase)

      const miniProgram = await getSharedMiniProgram(ctx)

      for (const routeCase of runtimeCase.routes) {
        const page = await relaunchPage(miniProgram, routeCase.route, routeCase.readyText)
        if (!page) {
          throw new Error(`[${runtimeCase.id}] failed to launch route: ${routeCase.route}`)
        }

        const result = await page.callMethod('_runE2E')
        expect(result?.ok).toBe(true)
        expect(result?.tokens).toEqual(expect.arrayContaining(routeCase.expectedTokens))
      }
    }, 2 * 60_000)
  }
})
