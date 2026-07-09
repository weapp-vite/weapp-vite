import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/issue-340-hoist')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:issue-340-hoist',
    skipNpm: true,
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function ensureBuildPrepared() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
}

async function getSharedMiniProgram() {
  await ensureBuildPrepared()

  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipRelaunchPageRootCheck: true,
      skipWarmup: true,
    })
  }

  return sharedMiniProgram
}

async function waitForRouteDom(
  miniProgram: any,
  expectedRoute: string,
  expectedPage: string,
  expectedMessage: string,
  timeoutMs = 15_000,
) {
  const startedAt = Date.now()
  let lastResult: Record<string, any> | null = null
  while (Date.now() - startedAt <= timeoutMs) {
    const result = await miniProgram.evaluate((route, pageName, message) => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve({
            ok: false,
            reason: 'selector-timeout',
          })
        }, 3_000)
        try {
          const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
          const page = pages[pages.length - 1] as any
          const currentRoute = page?.route || page?.__route__ || page?.path || ''
          const query = typeof wx !== 'undefined' && typeof wx.createSelectorQuery === 'function'
            ? wx.createSelectorQuery().in(page)
            : page?.createSelectorQuery?.()
          if (!query) {
            clearTimeout(timer)
            resolve({
              ok: false,
              reason: 'selector-query-unavailable',
              route: currentRoute,
            })
            return
          }
          query
            .select('.issue340-page')
            .fields({
              dataset: true,
              id: true,
              rect: true,
              size: true,
            })
            .exec((results: any[]) => {
              clearTimeout(timer)
              const root = results?.[0] as Record<string, any> | null | undefined
              resolve({
                ok: currentRoute === route
                  && root?.dataset?.e2ePage === pageName
                  && root?.dataset?.e2eMessage === message
                  && Number(root?.width ?? 0) > 0
                  && Number(root?.height ?? 0) > 0,
                dataset: root?.dataset ?? {},
                height: root?.height,
                route: currentRoute,
                width: root?.width,
              })
            })
        }
        catch (error) {
          clearTimeout(timer)
          resolve({
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          })
        }
      })
    }, expectedRoute.replace(/^\/+/, ''), expectedPage, expectedMessage) as Record<string, any>
    lastResult = result
    if (result?.ok === true) {
      return result
    }
    await delay(220)
  }
  throw new Error(`Timed out waiting issue-340 DOM for ${expectedRoute}: ${JSON.stringify(lastResult, null, 2)}`)
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

function normalizeRoute(route: string) {
  return route.replace(/^\/+/, '').replace(/\/+$/g, '')
}

function isExpectedRoute(page: any, route: string) {
  return normalizeRoute(String(page?.path ?? '')) === normalizeRoute(route)
}

function isRecoverableRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Timeout in .*?(?:reLaunch|navigateTo)|Connection closed|Target closed|WebSocket is not open|socket hang up|Execution context was destroyed|getPageMetaByWebviewId|DEVTOOLS_PROTOCOL_TIMEOUT/i.test(message)
}

async function restartSharedMiniProgram() {
  await closeSharedMiniProgram().catch(() => {})
  await delay(800)
  return await getSharedMiniProgram()
}

async function waitForRouteDomIfReady(
  miniProgram: any,
  route: string,
  pageName: string,
  message: string,
  timeoutMs: number,
) {
  try {
    return await waitForRouteDom(miniProgram, route, pageName, message, timeoutMs)
  }
  catch {
    return null
  }
}

async function launchRouteWithDom(
  route: string,
  pageName: string,
  message: string,
) {
  const routeMethods = normalizeRoute(route).startsWith('subpackages/')
    ? ['navigateTo', 'reLaunch'] as const
    : ['reLaunch'] as const
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let miniProgram = await getSharedMiniProgram()
    let restartedDuringAttempt = false
    for (const method of routeMethods) {
      if (typeof miniProgram?.[method] !== 'function') {
        continue
      }

      process.stdout.write(`[issue-340-hoist:route] ${method} route=${route} attempt=${attempt}/3\n`)
      try {
        const page = await miniProgram[method](route)
        if (page && !isExpectedRoute(page, route)) {
          process.stdout.write(`[issue-340-hoist:route] ${method}-unexpected-page route=${route} actual=${page.path ?? '<empty>'}\n`)
        }
      }
      catch (error) {
        lastError = error
        process.stdout.write(`[issue-340-hoist:route] ${method}-failed route=${route} attempt=${attempt}/3 reason=${error instanceof Error ? error.message : String(error)}\n`)
        const domAfterFailure = await waitForRouteDomIfReady(miniProgram, route, pageName, message, 5_000)
        if (domAfterFailure) {
          return {
            dom: domAfterFailure,
            miniProgram,
          }
        }
        if (isRecoverableRouteError(error)) {
          miniProgram = await restartSharedMiniProgram()
          restartedDuringAttempt = true
          continue
        }
        continue
      }

      const dom = await waitForRouteDomIfReady(miniProgram, route, pageName, message, 15_000)
      if (dom) {
        return {
          dom,
          miniProgram,
        }
      }
    }

    if (attempt < 3 && !restartedDuringAttempt) {
      await restartSharedMiniProgram()
    }
  }

  throw new Error(`Failed to launch issue-340 route ${route}: ${lastError instanceof Error ? lastError.message : String(lastError ?? 'DOM not ready')}`)
}

async function callCurrentRouteE2E(miniProgram: any, expectedRoute: string) {
  const result = await miniProgram.evaluate(async (route) => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const page = pages[pages.length - 1] as any
    const currentRoute = String(page?.route || page?.__route__ || page?.path || '').replace(/^\/+/, '').replace(/\/+$/g, '')
    if (currentRoute !== route) {
      return {
        error: `route mismatch: expected ${route}, actual ${currentRoute}`,
        ok: false,
      }
    }
    const method = page?._runE2E
    if (typeof method !== 'function') {
      return {
        error: '_runE2E is not ready',
        ok: false,
      }
    }
    return await method.call(page)
  }, normalizeRoute(expectedRoute)) as { error?: string, message?: string, ok?: boolean }

  if (result?.error) {
    throw new Error(result.error)
  }
  return result
}

describe.sequential('e2e app: issue-340-hoist runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('reLaunches both subpackage pages with hoisted shared imports intact', async () => {
    await ensureBuildPrepared()

    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')

    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')

    expect(itemPageJs).toContain('item-login-required:issue-340-hoist:shared')
    expect(userPageJs).toContain('user-register-form:issue-340-hoist:shared')

    const itemRoute = '/subpackages/item/login-required/index'
    const itemMessage = 'item-login-required:issue-340-hoist:shared'
    const itemLaunch = await launchRouteWithDom(itemRoute, 'item-login-required', itemMessage)
    const itemDom = itemLaunch.dom
    expect(itemDom.dataset).toMatchObject({
      e2eMessage: itemMessage,
      e2ePage: 'item-login-required',
    })
    const itemResult = await callCurrentRouteE2E(itemLaunch.miniProgram, itemRoute)
    expect(itemResult?.ok).toBe(true)
    expect(itemResult?.message).toBe(itemMessage)

    const userRoute = '/subpackages/user/register/form'
    const userMessage = 'user-register-form:issue-340-hoist:shared'
    const userLaunch = await launchRouteWithDom(userRoute, 'user-register-form', userMessage)
    const userDom = userLaunch.dom
    expect(userDom.dataset).toMatchObject({
      e2eMessage: userMessage,
      e2ePage: 'user-register-form',
    })
    const userResult = await callCurrentRouteE2E(userLaunch.miniProgram, userRoute)
    expect(userResult?.ok).toBe(true)
    expect(userResult?.message).toBe(userMessage)
  })
})
