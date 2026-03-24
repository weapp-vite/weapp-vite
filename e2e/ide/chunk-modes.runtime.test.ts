import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { chunkExtraCases, chunkMatrixCases, runtimeBaseRoutes } from '../chunk-modes.matrix'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const PREPARE_SCRIPT_PATH = path.resolve(import.meta.dirname, '../../scripts/chunk-modes-project.mjs')
const DIST_MATRIX_ROOT = path.join(APP_ROOT, 'dist-matrix')

const runtimeCases = [
  ...chunkMatrixCases.map(item => ({ id: item.id, env: item.env, routes: runtimeBaseRoutes })),
  ...chunkExtraCases.slice(0, 2).map(item => ({ id: item.id, env: item.env, routes: runtimeBaseRoutes })),
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

async function prepareScenarioProject(runtimeCase: RuntimeMatrixCase) {
  const scenarioRoot = path.join(DIST_MATRIX_ROOT, runtimeCase.id)
  await fs.remove(scenarioRoot)

  const result = await execa('node', [
    PREPARE_SCRIPT_PATH,
    '--scenario',
    runtimeCase.id,
  ], {
    cwd: APP_ROOT,
    reject: false,
    all: true,
  })

  if ((result.exitCode ?? 1) !== 0) {
    throw new Error(`[${runtimeCase.id}] prepare scenario failed\n${result.all ?? ''}`)
  }

  return scenarioRoot
}

async function getSharedMiniProgram(projectPath: string, ctx?: { skip: (message?: string) => void }) {
  if (sharedLaunchInfraUnavailableMessage) {
    ctx?.skip(sharedLaunchInfraUnavailableMessage)
    throw new Error(sharedLaunchInfraUnavailableMessage)
  }

  if (!sharedMiniProgram) {
    try {
      sharedMiniProgram = await launchAutomator({
        projectPath,
        timeout: 60_000,
        trustProject: true,
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
      const projectPath = await prepareScenarioProject(runtimeCase)

      const miniProgram = await getSharedMiniProgram(projectPath, ctx)

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
