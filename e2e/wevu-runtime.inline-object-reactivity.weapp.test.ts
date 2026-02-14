import { beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from './utils/automator'
import { APP_ROOT, normalizeAutomatorWxml, runBuild } from './wevu-runtime.utils'

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

async function tapById(page: any, id: string) {
  const selector = await resolveSelectorById(page, id)
  const target = await page.$(selector)
  if (!target) {
    throw new Error(`Failed to find target element: ${selector}`)
  }

  for (const mode of ['tap', 'trigger', 'dispatch'] as const) {
    try {
      if (mode === 'tap') {
        await target.tap()
      }
      else if (mode === 'trigger') {
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

  throw new Error(`Failed to dispatch tap on ${id}`)
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

      const steps = [
        { id: 'minus-0', expected: 1 },
        { id: 'minus-0', expected: 1 },
        { id: 'plus-0', expected: 2 },
        { id: 'plus-0', expected: 3 },
        { id: 'minus-0', expected: 2 },
      ] as const

      for (const step of steps) {
        await tapById(page, step.id)
        await expectQtySynced(page, step.expected, 6_000)
      }
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
      await expectQtySynced(page, 2)

      for (let i = 0; i < 5; i += 1) {
        await tapById(page, 'plus-0')
      }
      await expectQtySynced(page, 7, 8_000)

      for (let i = 0; i < 12; i += 1) {
        await tapById(page, 'minus-0')
      }
      await expectQtySynced(page, 1, 8_000)

      for (let i = 0; i < 3; i += 1) {
        await tapById(page, 'plus-0')
      }
      await expectQtySynced(page, 4, 8_000)
    }
    finally {
      await miniProgram.close()
    }
  })
})
