import { beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { APP_ROOT, normalizeAutomatorWxml, runBuild } from '../wevu-runtime.utils'

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readPageWxml(page: any) {
  const root = await page.$('page')
  if (!root) {
    throw new Error('Failed to find page element')
  }
  return normalizeAutomatorWxml(await root.wxml())
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
  const runtime = await page.callMethod('runE2E')
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
  const directElement = await page.$(directSelector)
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
  const target = await page.$(selector)
  if (!target) {
    throw new Error(`Failed to find target element: ${selector}`)
  }

  for (const mode of ['trigger', 'dispatch'] as const) {
    try {
      if (mode === 'trigger') {
        await target.trigger('tap')
      }
      else {
        await target.dispatchEvent({ eventName: 'tap' })
      }
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

async function tapBySelectorRepeated(page: any, selector: string, times: number, paceMs = 120) {
  for (let i = 0; i < times; i += 1) {
    await tapBySelector(page, selector)
    await page.waitFor(paceMs)
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

  it('updates qty for minus/plus taps and enforces min bound', async () => {
    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

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

  it('keeps qty stable under repeated taps', async () => {
    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

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
