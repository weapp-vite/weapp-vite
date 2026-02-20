import { beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { APP_ROOT, normalizeAutomatorWxml, runBuild } from '../wevu-runtime.utils'

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      factory(),
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
  }
}

function shouldRetryAutomatorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Wait timed out after')
    || message.includes('Timeout in ')
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
    const wxml = await readPageWxml(page)
    const qty = tryReadQtyFromWxml(wxml)
    if (qty === expected) {
      return qty
    }
    await page.waitFor(220)
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
    const wxml = await readPageWxml(page)
    if (wxml.includes(text)) {
      return wxml
    }
    await page.waitFor(220)
  }
  throw new Error(`Timed out waiting text: ${text}`)
}

interface ReproSelectors {
  minus: string
  plus: string
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

async function resolveReproSelectors(page: any): Promise<ReproSelectors> {
  return {
    minus: await resolveSelectorById(page, 'minus-0'),
    plus: await resolveSelectorById(page, 'plus-0'),
  }
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

async function tapBySelectorRepeated(page: any, selector: string, times: number, paceMs = 200) {
  for (let i = 0; i < times; i += 1) {
    await tapBySelector(page, selector)
    await runAutomatorOp(`pace wait ${paceMs}ms`, () => page.waitFor(paceMs), {
      timeoutMs: Math.max(paceMs + 3_000, 5_000),
    })
  }
}

async function tapByIdAndExpectQty(page: any, id: string, expected: number, timeoutMs = 6_000) {
  await tapById(page, id)
  await expectQtySynced(page, expected, timeoutMs)
}

describe.sequential('wevu runtime inline object reactivity (weapp e2e)', () => {
  beforeAll(async () => {
    await runBuild('weapp')
  })

  it('updates qty for minus/plus taps and enforces min bound', async (ctx) => {
    let miniProgram
    try {
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        ctx.skip('WeChat DevTools 服务端口未开启，跳过 IDE 自动化用例。')
      }
      throw error
    }

    try {
      const page = await miniProgram.reLaunch('/pages/wevu-inline-object-reactivity-repro/index')
      if (!page) {
        throw new Error('Failed to launch inline-object-reactivity-repro page')
      }

      await waitForWxmlContains(page, 'minus-0')
      await waitForWxmlContains(page, 'plus-0')
      await expectQtySynced(page, 2)

      await tapByIdAndExpectQty(page, 'minus-0', 1)
      await tapByIdAndExpectQty(page, 'minus-0', 1)
      await tapByIdAndExpectQty(page, 'plus-0', 2)
      await tapByIdAndExpectQty(page, 'plus-0', 3)
      await tapByIdAndExpectQty(page, 'minus-0', 2)
    }
    finally {
      await miniProgram.close()
    }
  })

  it('keeps qty stable under repeated taps', async (ctx) => {
    let miniProgram
    try {
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        ctx.skip('WeChat DevTools 服务端口未开启，跳过 IDE 自动化用例。')
      }
      throw error
    }

    try {
      const page = await miniProgram.reLaunch('/pages/wevu-inline-object-reactivity-repro/index')
      if (!page) {
        throw new Error('Failed to launch inline-object-reactivity-repro page')
      }

      await waitForWxmlContains(page, 'minus-0')
      await waitForWxmlContains(page, 'plus-0')
      const selectors = await resolveReproSelectors(page)
      await expectQtySynced(page, 2)

      await tapBySelectorRepeated(page, selectors.plus, 5)
      await expectQtySynced(page, 7, 10_000)

      await tapBySelectorRepeated(page, selectors.minus, 12)
      await expectQtySynced(page, 1, 10_000)

      await tapBySelectorRepeated(page, selectors.plus, 3)
      await expectQtySynced(page, 4, 10_000)
    }
    finally {
      await miniProgram.close()
    }
  })
})
