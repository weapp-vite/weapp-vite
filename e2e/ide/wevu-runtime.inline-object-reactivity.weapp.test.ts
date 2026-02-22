import { beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { APP_ROOT, normalizeAutomatorWxml, runBuild } from '../wevu-runtime.utils'

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
    || message.includes('listen EPERM')
    || message.includes('EADDRINUSE')
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
  try {
    return await runAutomatorOp('launch automator', () => launchAutomator({
      projectPath: APP_ROOT,
    }), {
      timeoutMs: 24_000,
      retries: 3,
      retryDelayMs: 320,
    })
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      ctx.skip('WeChat DevTools 服务端口未开启，跳过 IDE 自动化用例。')
    }
    throw error
  }
}

async function readPageWxml(page: any) {
  const root = await runAutomatorOp('query page root', () => page.$('page'))
  if (!root) {
    throw new Error('Failed to find page element')
  }
  const wxml = await runAutomatorOp('read page wxml', () => root.wxml())
  return normalizeAutomatorWxml(wxml)
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
  while (Date.now() - start <= timeoutMs) {
    try {
      const wxml = await readPageWxml(page)
      const qty = tryReadQtyFromWxml(wxml)
      if (qty === expected) {
        return qty
      }
    }
    catch {
      // 页面切换后的瞬态读取失败可忽略，继续等待目标状态收敛。
    }
    await sleep(220)
  }
  throw new Error(`Timed out waiting qty=${expected}`)
}

async function expectQtySynced(page: any, expected: number, timeoutMs = 10_000) {
  const qty = await waitForQty(page, expected, timeoutMs)
  expect(qty).toBe(expected)
  const runtime = await runAutomatorOp('call runE2E', () => page.callMethod('runE2E'), {
    timeoutMs: 10_000,
  })
  expect(runtime?.qty).toBe(expected)
}

async function waitForWxmlContains(page: any, text: string, timeoutMs = 10_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const wxml = await readPageWxml(page)
      if (wxml.includes(text)) {
        return wxml
      }
    }
    catch {
      // 页面初始化期间可能短暂无根节点，继续轮询。
    }
    await sleep(220)
  }
  throw new Error(`Timed out waiting text: ${text}`)
}

async function resolveSelectorById(page: any, id: string) {
  const directSelector = `#${id}`
  const directElement = await runAutomatorOp(`query selector ${directSelector}`, () => page.$(directSelector))
  if (directElement) {
    return directSelector
  }

  const wxml = await readPageWxml(page)
  const scopedMatch = wxml.match(new RegExp(`id=\"([^\"]*${escapeRegExp(id)})\"`))
  if (scopedMatch?.[1]) {
    return `#${scopedMatch[1]}`
  }

  throw new Error(`Failed to resolve selector by id: ${id}`)
}

async function tapBySelector(page: any, selector: string) {
  const target = await runAutomatorOp(`query tap target ${selector}`, () => page.$(selector))
  if (!target) {
    throw new Error(`Failed to find target element: ${selector}`)
  }

  for (const mode of ['dispatch', 'trigger', 'tap'] as const) {
    try {
      await runAutomatorOp(`tap ${selector} via ${mode}`, async () => {
        if (mode === 'dispatch') {
          await target.dispatchEvent({ eventName: 'tap' })
          return
        }
        if (mode === 'trigger') {
          await target.trigger('tap')
          return
        }
        await target.tap()
      }, { timeoutMs: 8_000, retries: 2, retryDelayMs: 120 })
      return
    }
    catch {
    }
  }

  throw new Error(`Failed to dispatch tap on selector: ${selector}`)
}

async function tapById(page: any, id: string) {
  const selector = await resolveSelectorById(page, id)
  await tapBySelector(page, selector)
}

async function tapByIdAndExpectQty(page: any, id: string, expected: number, timeoutMs = 6_000) {
  await tapById(page, id)
  await expectQtySynced(page, expected, timeoutMs)
}

async function tapByIdRepeated(page: any, id: string, times: number, paceMs = 200) {
  for (let i = 0; i < times; i += 1) {
    await tapById(page, id)
    await sleep(paceMs)
  }
}

async function openInlineObjectPage(miniProgram: any) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const page = await runAutomatorOp('reLaunch inline-object page', () => miniProgram.reLaunch('/pages/wevu-inline-object-reactivity-repro/index'), {
        timeoutMs: 18_000,
        retries: 2,
        retryDelayMs: 280,
      })
      if (!page) {
        throw new Error('Failed to launch inline-object-reactivity-repro page')
      }
      await waitForWxmlContains(page, 'minus-0', 12_000)
      await waitForWxmlContains(page, 'plus-0', 12_000)
      return page
    }
    catch (error) {
      lastError = error
      if (attempt < 3) {
        await sleep(300)
      }
    }
  }
  throw lastError
}

async function runInlineObjectScenario(
  ctx: { skip: (message?: string) => void },
  scenario: (page: any) => Promise<void>,
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let miniProgram
    try {
      miniProgram = await launchMiniProgramWithRetry(ctx)
      const page = await openInlineObjectPage(miniProgram)
      await expectQtySynced(page, 2)
      await scenario(page)
      return
    }
    catch (error) {
      lastError = error
      if (attempt < 2 && shouldRetryAutomatorError(error)) {
        await sleep(300)
        continue
      }
      throw error
    }
    finally {
      if (miniProgram) {
        await runAutomatorOp('close mini program', () => miniProgram.close(), {
          timeoutMs: 12_000,
          retries: 2,
          retryDelayMs: 200,
        }).catch(() => {})
      }
    }
  }
  throw lastError
}

describe.sequential('wevu runtime inline object reactivity (weapp e2e)', () => {
  beforeAll(async () => {
    await runBuild('weapp')
  })

  it('updates qty for minus/plus taps and enforces min bound', async (ctx) => {
    await runInlineObjectScenario(ctx, async (page) => {
      await tapByIdAndExpectQty(page, 'minus-0', 1)
      await tapByIdAndExpectQty(page, 'minus-0', 1)
      await tapByIdAndExpectQty(page, 'plus-0', 2)
      await tapByIdAndExpectQty(page, 'plus-0', 3)
      await tapByIdAndExpectQty(page, 'minus-0', 2)
    })
  })

  it('keeps qty stable under repeated taps', async (ctx) => {
    await runInlineObjectScenario(ctx, async (page) => {
      await tapByIdRepeated(page, 'plus-0', 5)
      await expectQtySynced(page, 7, 10_000)

      await tapByIdRepeated(page, 'minus-0', 12)
      await expectQtySynced(page, 1, 10_000)

      await tapByIdRepeated(page, 'plus-0', 3)
      await expectQtySynced(page, 4, 10_000)
    })
  })
})
