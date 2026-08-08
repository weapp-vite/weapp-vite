import type { Buffer } from 'node:buffer'
import type { Page } from 'playwright'
import { PNG } from 'pngjs'

export const COMPONENT_LIBRARY_MOBILE_VIEWPORT = { width: 375, height: 812 } as const
export const COMPONENT_LIBRARY_DESKTOP_VIEWPORT = { width: 1280, height: 900 } as const
const SCENARIO_TIMEOUT = 20_000
const SCREENSHOT_STABILITY_TIMEOUT = 5_000
const SCREENSHOT_SAMPLE_INTERVAL = 80
const SCREENSHOT_STABLE_SAMPLES = 3

export interface ComponentScenarioLike {
  component: string
  route: string
  expectedState: string
}

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
    issues.push({ type: 'pageerror', message: error.stack ?? error.message })
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
  await page.waitForFunction(() => {
    const host = window as any
    return typeof host.wx?.reLaunch === 'function'
      && typeof host.getCurrentPages === 'function'
      && host.getCurrentPages().length > 0
  }, undefined, { timeout: 45_000 })
}

async function waitForStableAssets(page: Page, scenario: ComponentScenarioLike) {
  await page.evaluate(async ({ component, timeout }) => {
    await document.fonts?.ready
    const findScenarioRoot = (root: ParentNode): HTMLElement | null => {
      for (const element of root.querySelectorAll<HTMLElement>('*')) {
        if (element.id === 'e2e-root' && element.dataset.component === component) {
          return element
        }
        if (element.shadowRoot) {
          const match = findScenarioRoot(element.shadowRoot)
          if (match) {
            return match
          }
        }
      }
      return null
    }
    const scenarioRoot = findScenarioRoot(document)
    if (!scenarioRoot) {
      throw new Error(`${component}: 当前场景根节点不存在`)
    }
    const images: HTMLImageElement[] = []
    const visit = (root: ParentNode) => {
      images.push(...root.querySelectorAll('img'))
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) {
          visit(element.shadowRoot)
        }
      }
    }
    visit(scenarioRoot)
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
}

export async function captureStableScreenshot(page: Page, label: string) {
  const deadline = Date.now() + SCREENSHOT_STABILITY_TIMEOUT
  let previous: Buffer | undefined
  let consecutiveStableSamples = 1
  let samples = 0

  while (Date.now() < deadline) {
    const current = await page.screenshot({ animations: 'disabled' })
    samples += 1
    consecutiveStableSamples = previous?.equals(current) ? consecutiveStableSamples + 1 : 1
    if (consecutiveStableSamples >= SCREENSHOT_STABLE_SAMPLES) {
      return current
    }
    previous = current
    await page.waitForTimeout(SCREENSHOT_SAMPLE_INTERVAL)
  }

  throw new Error(
    `[component-library-web] ${label} 在 ${samples} 次采样后仍未达到连续 ${SCREENSHOT_STABLE_SAMPLES} 帧像素稳定`,
  )
}

export async function initializeComponentLibraryPage(page: Page, webUrl: string, issues: RuntimeIssue[] = []) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: (position: GeolocationPosition) => void) {
          success({
            coords: {
              accuracy: 1,
              altitude: 0,
              altitudeAccuracy: 1,
              heading: 0,
              latitude: 31.2304,
              longitude: 121.4737,
              speed: 0,
            },
            timestamp: 0,
          } as GeolocationPosition)
        },
      },
    })
  })
  await page.goto(webUrl, { waitUntil: 'domcontentloaded' })
  try {
    await waitForRuntime(page)
  }
  catch (error) {
    const details = issues.map(issue => `${issue.type}: ${issue.message}`).join('\n')
    throw new Error(`${error instanceof Error ? error.message : String(error)}${details ? `\n${details}` : ''}`)
  }
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

export async function navigateToScenario(
  page: Page,
  scenario: ComponentScenarioLike,
  issues: RuntimeIssue[] = [],
) {
  const issueOffset = issues.length
  const navigationError = await page.evaluate(async ({ component, route, timeout }) => {
    try {
      await Promise.race([
        (window as any).wx.reLaunch({ url: route }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`${component}: wx.reLaunch 超时`)), timeout)
        }),
      ])
      return null
    }
    catch (error) {
      if (error instanceof Error) {
        return error.message
      }
      try {
        return JSON.stringify(error)
      }
      catch {
        return String(error)
      }
    }
  }, {
    component: scenario.component,
    route: scenario.route,
    timeout: SCENARIO_TIMEOUT,
  })
  if (navigationError) {
    throw new Error(`${scenario.component}: wx.reLaunch(${scenario.route}) 失败: ${navigationError}`)
  }
  try {
    await page.locator(`#e2e-root[data-component="${scenario.component}"]`).waitFor({
      state: 'attached',
      timeout: 30_000,
    })
  }
  catch (error) {
    const details = issues.slice(issueOffset)
      .map(issue => `${issue.type}: ${issue.message}${issue.url ? ` (${issue.url})` : ''}`)
      .join('\n')
    throw new Error(`${scenario.component}: 页面根节点未挂载${details ? `\n${details}` : ''}`, { cause: error })
  }
  await waitForStableAssets(page, scenario)
}

export async function runWebScenario(
  page: Page,
  scenario: ComponentScenarioLike,
  issues: RuntimeIssue[],
): Promise<ScenarioResult> {
  const issueOffset = issues.length
  await navigateToScenario(page, scenario, issues)
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
    timeout: SCENARIO_TIMEOUT,
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
    throw new Error(`[component-library-web] ${label} 截图疑似空白，非背景像素占比 ${ratio}`)
  }
  return { width: png.width, height: png.height, nonBlankRatio: ratio }
}
