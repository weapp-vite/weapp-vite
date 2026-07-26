import type { Buffer } from 'node:buffer'
import type { Page } from 'playwright'
import type { ComponentScenario } from '../../e2e-apps/wot-ui-compat/src/scenarios'
import { PNG } from 'pngjs'

export const WOT_UI_MOBILE_VIEWPORT = { width: 375, height: 812 } as const
export const WOT_UI_DESKTOP_VIEWPORT = { width: 1280, height: 900 } as const
const WOT_UI_SCENARIO_TIMEOUT = 20_000

export interface RuntimeIssue {
  type: 'console' | 'pageerror' | 'requestfailed'
  message: string
  url?: string
}

export interface ScenarioResult {
  component: string
  expectedState: string
  actualState: string
  targetCount: number
  rootCount: number
  targetBox: { width: number, height: number } | null
  subjectBox: { width: number, height: number } | null
  issues: RuntimeIssue[]
}

function isIgnoredConsoleMessage(message: string) {
  return message.includes('Lit is in dev mode')
}

export function collectRuntimeIssues(page: Page) {
  const issues: RuntimeIssue[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnoredConsoleMessage(message.text())) {
      issues.push({ type: 'console', message: message.text() })
    }
  })
  page.on('pageerror', (error) => {
    issues.push({ type: 'pageerror', message: error.message })
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.startsWith('http://127.0.0.1:')) {
      issues.push({
        type: 'requestfailed',
        message: request.failure()?.errorText ?? 'request failed',
        url,
      })
    }
  })
  return issues
}

async function waitForRuntime(page: Page) {
  await page.waitForFunction(() => typeof (window as any).wx?.reLaunch === 'function', undefined, {
    timeout: 45_000,
  })
}

async function waitForStableAssets(page: Page, scenario: ComponentScenario) {
  await page.evaluate(async ({ component, timeout }) => {
    await document.fonts?.ready
    const images: HTMLImageElement[] = []
    const visit = (root: ParentNode) => {
      images.push(...root.querySelectorAll('img'))
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) {
          visit(element.shadowRoot)
        }
      }
    }
    visit(document)
    const pendingImages = images.filter(image => Boolean(image.currentSrc || image.getAttribute('src')) && !image.complete)
    const pendingSources = pendingImages.map(image => image.currentSrc || image.getAttribute('src') || '<unknown>')
    await Promise.race([
      Promise.all(pendingImages.map(image => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          }))),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(
          `${component}: 资源稳定等待超时 (${pendingSources.join(', ')})`,
        )), timeout)
      }),
    ])
  }, {
    component: scenario.component,
    timeout: 8_000,
  })
  await page.waitForTimeout(120)
}

export async function initializeWotUiPage(page: Page, webUrl: string) {
  await page.goto(webUrl, { waitUntil: 'domcontentloaded' })
  await waitForRuntime(page)
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        caret-color: transparent !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        animation-delay: 0s !important;
        animation-duration: 0s !important;
      }
    `,
  })
}

export async function navigateToScenario(page: Page, scenario: ComponentScenario) {
  await page.evaluate(async ({ component, route, timeout }) => {
    await Promise.race([
      (window as any).wx.reLaunch({ url: route }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${component}: wx.reLaunch 超时`)), timeout)
      }),
    ])
  }, {
    component: scenario.component,
    route: scenario.route,
    timeout: WOT_UI_SCENARIO_TIMEOUT,
  })
  await page.locator('#e2e-root').waitFor({ state: 'attached', timeout: 30_000 })
  await waitForStableAssets(page, scenario)
}

export async function runWebScenario(
  page: Page,
  scenario: ComponentScenario,
  issues: RuntimeIssue[],
): Promise<ScenarioResult> {
  const issueOffset = issues.length
  await navigateToScenario(page, scenario)
  const target = page.locator('#e2e-component')
  const subject = page.locator('#e2e-target')
  const rootCount = await page.locator('#e2e-root').count()
  const targetCount = await target.count()
  const targetBox = targetCount === 1 ? await target.boundingBox() : null
  const subjectBox = await subject.boundingBox()
  await page.evaluate(async ({ component, timeout }) => {
    const pages = (window as any).getCurrentPages?.() ?? []
    const currentPage = pages[pages.length - 1]
    if (typeof currentPage?.runE2E !== 'function') {
      throw new TypeError(`${component}: 当前页面未暴露 runE2E()`)
    }
    await Promise.race([
      currentPage.runE2E(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${component}: runE2E() 超时`)), timeout)
      }),
    ])
  }, {
    component: scenario.component,
    timeout: WOT_UI_SCENARIO_TIMEOUT,
  })
  const stateDeadline = Date.now() + 3_000
  while (Date.now() < stateDeadline) {
    const state = (await page.locator('#e2e-state').textContent())?.trim() ?? ''
    if (state.startsWith(scenario.expectedState)) {
      break
    }
    await page.waitForTimeout(50)
  }
  const actualState = (await page.locator('#e2e-state').textContent())?.trim() ?? ''
  await page.waitForTimeout(50)
  return {
    component: scenario.component,
    expectedState: scenario.expectedState,
    actualState,
    targetCount,
    rootCount,
    targetBox: targetBox ? { width: targetBox.width, height: targetBox.height } : null,
    subjectBox: subjectBox ? { width: subjectBox.width, height: subjectBox.height } : null,
    issues: issues.slice(issueOffset),
  }
}

export function assertNonBlankPng(buffer: Buffer, label: string) {
  const png = PNG.sync.read(buffer)
  let nonBlankPixels = 0
  const first = [png.data[0], png.data[1], png.data[2], png.data[3]]
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const differs = png.data[offset] !== first[0]
      || png.data[offset + 1] !== first[1]
      || png.data[offset + 2] !== first[2]
      || png.data[offset + 3] !== first[3]
    if (differs) {
      nonBlankPixels += 1
    }
  }
  const ratio = nonBlankPixels / (png.width * png.height)
  if (ratio < 0.002) {
    throw new Error(`[wot-ui-web] ${label} 截图疑似空白，非背景像素占比 ${ratio}`)
  }
  return { width: png.width, height: png.height, nonBlankRatio: ratio }
}
