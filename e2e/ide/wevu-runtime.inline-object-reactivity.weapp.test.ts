import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { APP_ROOT, normalizeAutomatorWxml, runBuild } from '../wevu-runtime.utils'

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  const task = Promise.resolve()
    .then(factory)
    .then((value) => {
      settled = true
      return value
    })
    .catch((error) => {
      settled = true
      throw error
    })
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
    if (!settled) {
      void task.catch(() => {})
    }
  }
}

function shouldRetryAutomatorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Wait timed out after')
    || message.includes('Timeout in ')
    || message.includes('DevTools did not respond to protocol method')
    || message.includes('listen EPERM')
    || message.includes('EADDRINUSE')
    || message.includes('Target closed')
    || message.includes('WebSocket is not open')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('simulator not found')
    || message.includes('模拟器启动失败')
    || message.includes('Timed out waiting qty=')
    || message.includes('Timed out waiting text:')
    || message.includes('Failed to find page element')
    || message.includes('Failed to resolve selector by id')
    || /subPackages[\s\S]{0,80}undefined/i.test(message)
}

async function runAutomatorOp<T>(
  label: string,
  factory: () => Promise<T>,
  options: { timeoutMs?: number, retries?: number, retryDelayMs?: number } = {},
) {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryDelayMs = 160,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runWithTimeout(factory, timeoutMs, `${label}#${attempt}`)
    }
    catch (error) {
      lastError = error
      if (attempt < retries && shouldRetryAutomatorError(error)) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs))
        continue
      }
      throw error
    }
  }
  throw lastError
}

async function launchMiniProgramWithRetry(ctx: { skip: (message?: string) => void }) {
  let lastError: unknown
  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await cleanupResidualIdeProcesses()
        if (attempt > 1) {
          await cleanDevtoolsCache(attempt === 2 ? 'compile' : 'all', { cwd: APP_ROOT }).catch(() => {})
          await sleep(500)
        }
        return await launchAutomator({
          projectPath: APP_ROOT,
        })
      }
      catch (error) {
        lastError = error
        if (attempt < 3 && shouldRetryAutomatorError(error)) {
          continue
        }
        throw error
      }
    }
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      ctx.skip('WeChat DevTools 服务端口未开启，跳过 IDE 自动化用例。')
    }
    throw error
  }
  throw lastError
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function closeMiniProgramSafely(miniProgram: any) {
  await runAutomatorOp('close mini program', () => miniProgram.close(), {
    timeoutMs: 12_000,
    retries: 2,
    retryDelayMs: 200,
  }).catch(() => {})
}

async function getSharedMiniProgram(ctx: { skip: (message?: string) => void }) {
  if (!sharedBuildPrepared) {
    await runBuild('weapp')
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchMiniProgramWithRetry(ctx)
  }
  return sharedMiniProgram
}

async function resetSharedMiniProgram(ctx: { skip: (message?: string) => void }) {
  if (sharedMiniProgram) {
    await closeMiniProgramSafely(sharedMiniProgram)
    sharedMiniProgram = null
  }
  sharedMiniProgram = await launchMiniProgramWithRetry(ctx)
  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await closeMiniProgramSafely(miniProgram)
}

async function readPageWxml(page: any) {
  if (typeof page?.wxml === 'function') {
    const wxml = await runAutomatorOp('read page wxml', () => page.wxml())
    return normalizeAutomatorWxml(wxml)
  }
  let lastError: unknown
  for (const selector of ['page', 'body', 'weapp-app-shell', 'view']) {
    try {
      const root = await runAutomatorOp(`query page root ${selector}`, () => page.$(selector), {
        timeoutMs: 3_000,
        retries: 1,
      })
      if (!root) {
        continue
      }
      const wxml = await runAutomatorOp(`read page wxml ${selector}`, () => root.wxml())
      return normalizeAutomatorWxml(wxml)
    }
    catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to find page element')
}

function readQtyFromWxml(wxml: string) {
  const match = wxml.match(/id="[^"]*qty-0[^"]*"[^>]*data-qty="(\d+)"/)
    ?? wxml.match(/data-qty="(\d+)"[^>]*id="[^"]*qty-0[^"]*"/)
  if (!match) {
    throw new Error(`Failed to read qty text from WXML: ${wxml}`)
  }
  return Number(match[1].trim())
}

function tryReadQtyFromWxml(wxml: string) {
  try {
    return readQtyFromWxml(wxml)
  }
  catch {
    return undefined
  }
}

async function waitForQty(page: any, expected: number, timeoutMs = 10_000) {
  const start = Date.now()
  const expectedText = String(expected)
  const latest: string[] = []
  while (Date.now() - start <= timeoutMs) {
    try {
      const nodes = typeof page.renderedNodes === 'function'
        ? await runAutomatorOp('read qty rendered node', () => page.renderedNodes('#qty-0', {
            timeout: 4_000,
          }), {
            timeoutMs: 6_000,
            retries: 1,
          })
        : []
      const nodeQty = Array.isArray(nodes)
        ? Number(nodes.find((node: any) => String(node?.id ?? '').includes('qty-0'))?.dataset?.qty)
        : Number.NaN
      latest.push(`rendered=${JSON.stringify(nodes).slice(0, 240)}`)
      if (nodeQty === expected) {
        return nodeQty
      }
    }
    catch (error) {
      latest.push(`rendered-error=${error instanceof Error ? error.message : String(error)}`)
      // 页面切换后的瞬态读取失败可忽略，继续等待目标状态收敛。
    }
    try {
      const element = await runAutomatorOp('query qty element', () => page.$('#qty-0'), {
        timeoutMs: 4_000,
        retries: 1,
      })
      const attrQty = Number(await runAutomatorOp('read qty attribute', () => element?.attribute('data-qty'), {
        timeoutMs: 4_000,
        retries: 1,
      }))
      latest.push(`attr=${attrQty}`)
      if (attrQty === expected) {
        return attrQty
      }
      const textQty = String(await runAutomatorOp('read qty text', () => element?.text(), {
        timeoutMs: 4_000,
        retries: 1,
      }) ?? '').trim()
      latest.push(`text=${textQty}`)
      if (textQty === expectedText) {
        return expected
      }
    }
    catch (error) {
      latest.push(`element-error=${error instanceof Error ? error.message : String(error)}`)
      // 页面切换后的瞬态读取失败可忽略，继续等待目标状态收敛。
    }
    try {
      const wxml = await readPageWxml(page)
      const qty = tryReadQtyFromWxml(wxml)
      latest.push(`wxmlQty=${qty ?? 'missing'} wxml=${wxml.slice(0, 240)}`)
      if (qty === expected) {
        return qty
      }
    }
    catch (error) {
      latest.push(`wxml-error=${error instanceof Error ? error.message : String(error)}`)
      // 页面切换后的瞬态读取失败可忽略，继续等待目标状态收敛。
    }
    await sleep(220)
  }
  throw new Error(`Timed out waiting qty=${expected}; latest=${latest.slice(-8).join(' || ')}`)
}

async function expectQtySynced(page: any, expected: number, timeoutMs = 10_000, miniProgram?: any) {
  let qty: number
  try {
    qty = await waitForQty(page, expected, timeoutMs)
  }
  catch (error) {
    if (!miniProgram || !shouldRetryAutomatorError(error)) {
      throw error
    }
    const freshPage = await runAutomatorOp('refresh current page for qty sync', () => miniProgram.currentPage({
      retries: 2,
      timeout: 5_000,
    }), {
      timeoutMs: 8_000,
      retries: 2,
    })
    qty = await waitForQty(freshPage, expected, timeoutMs)
    page = freshPage
  }
  expect(qty).toBe(expected)
  try {
    const runtime = await runAutomatorOp('call runE2E', () => {
      if (typeof page.callMethodWithOptions === 'function') {
        return page.callMethodWithOptions('runE2E', {
          fallback: false,
          timeout: 2_500,
        })
      }
      return page.callMethod('runE2E')
    }, {
      timeoutMs: 4_000,
      retries: 1,
    })
    if (runtime != null) {
      expect(runtime?.qty).toBe(expected)
    }
  }
  catch (error) {
    if (!shouldRetryAutomatorError(error)) {
      throw error
    }
  }
}

async function runActionsAndExpectQty(
  page: any,
  actions: Array<'minus' | 'plus'>,
  expected: number,
  timeoutMs = 6_000,
  miniProgram?: any,
) {
  const runtime = await runAutomatorOp('call runE2E actions', () => {
    if (typeof page.callMethodWithOptions === 'function') {
      return page.callMethodWithOptions('runE2E', {
        routeOnly: true,
      }, actions)
    }
    return page.callMethod('runE2E', actions)
  }, {
    timeoutMs: 12_000,
    retries: 2,
    retryDelayMs: 180,
  })
  expect(runtime?.qty).toBe(expected)
  await expectQtySynced(page, expected, timeoutMs, miniProgram)
}

async function openInlineObjectPage(miniProgram: any) {
  const page = await runAutomatorOp('reLaunch inline-object page', () => miniProgram.reLaunch('/pages/wevu-inline-object-reactivity-repro/index'), {
    timeoutMs: 18_000,
    retries: 2,
    retryDelayMs: 280,
  })
  if (!page) {
    throw new Error('Failed to launch inline-object-reactivity-repro page')
  }
  await expectQtySynced(page, 2, 12_000)
  return page
}

async function runInlineObjectScenario(
  ctx: { skip: (message?: string) => void },
  scenario: (page: any, miniProgram: any) => Promise<void>,
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 1; attempt += 1) {
    try {
      const miniProgram = await getSharedMiniProgram(ctx)
      const page = await openInlineObjectPage(miniProgram)
      await scenario(page, miniProgram)
      return
    }
    catch (error) {
      lastError = error
      if (attempt < 3 && shouldRetryAutomatorError(error)) {
        await resetSharedMiniProgram(ctx)
        await sleep(300)
        continue
      }
      throw error
    }
  }
  throw lastError
}

describe.sequential('wevu runtime inline object reactivity (weapp e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('updates qty for minus/plus taps and enforces min bound', async (ctx) => {
    await runInlineObjectScenario(ctx, async (page, miniProgram) => {
      await runActionsAndExpectQty(page, ['minus'], 1, 6_000, miniProgram)
      await runActionsAndExpectQty(page, ['minus'], 1, 6_000, miniProgram)
      await runActionsAndExpectQty(page, ['plus'], 2, 6_000, miniProgram)
      await runActionsAndExpectQty(page, ['plus'], 3, 6_000, miniProgram)
      await runActionsAndExpectQty(page, ['minus'], 2, 6_000, miniProgram)
    })
  })

  it('keeps qty stable under repeated taps', async (ctx) => {
    await runInlineObjectScenario(ctx, async (page, miniProgram) => {
      await runActionsAndExpectQty(page, ['plus', 'plus', 'plus', 'plus', 'plus'], 7, 10_000, miniProgram)
      await runActionsAndExpectQty(page, [
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
        'minus',
      ], 1, 10_000, miniProgram)
      await runActionsAndExpectQty(page, ['plus', 'plus', 'plus'], 4, 10_000, miniProgram)
    })
  })
})
