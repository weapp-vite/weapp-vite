/* eslint-disable e18e/ban-dependencies -- github issues IDE e2e 使用 fs-extra 简化构建产物读写。 */
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { expect } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const AUTOMATOR_OVERLAY_RE = /\s*\.luna-dom-highlighter[\s\S]*$/
const WHITESPACE_RE = /\s+/g
const REGEXP_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g
const LEADING_SLASH_RE = /^\/+/
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
export const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: APP_ROOT,
    label: 'ide:github-issues',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false
let sharedLaunchInfraUnavailableMessage: string | null = null

export async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
}

async function runAutomatorOp<T>(
  label: string,
  factory: () => Promise<T>,
  options: { timeoutMs?: number, retries?: number, retryDelayMs?: number } = {},
) {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryDelayMs = 220,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runWithTimeout(factory, timeoutMs, `${label}#${attempt}`)
    }
    catch (error) {
      lastError = error
      if (attempt < retries && shouldRetryAutomatorError(error)) {
        await delay(retryDelayMs)
        continue
      }
      throw error
    }
  }

  throw lastError
}

async function closeMiniProgramSafely(miniProgram: any) {
  await runAutomatorOp('close mini program', () => miniProgram.close(), {
    timeoutMs: 12_000,
    retries: 2,
    retryDelayMs: 200,
  }).catch(() => {})
}

export async function getSharedMiniProgram(ctx?: { skip: (message?: string) => void }) {
  if (sharedLaunchInfraUnavailableMessage) {
    ctx?.skip(sharedLaunchInfraUnavailableMessage)
    throw new Error(sharedLaunchInfraUnavailableMessage)
  }

  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    try {
      sharedMiniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
    }
    catch (error) {
      if (ctx && isDevtoolsHttpPortError(error)) {
        sharedLaunchInfraUnavailableMessage = 'WeChat DevTools 基础设施不可用，跳过 github-issues IDE 自动化用例。'
        ctx.skip(sharedLaunchInfraUnavailableMessage)
      }
      throw error
    }
  }
  return sharedMiniProgram
}

export async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await closeMiniProgramSafely(miniProgram)
}

export async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await closeMiniProgramSafely(miniProgram)
}

async function restartSharedMiniProgram(ctx?: { skip: (message?: string) => void }) {
  await closeSharedMiniProgram()
  return await getSharedMiniProgram(ctx)
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(AUTOMATOR_OVERLAY_RE, '')
}

export async function readPageWxml(page: any) {
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
    }

    if (typeof page?.waitFor === 'function') {
      try {
        await page.waitFor(220)
        continue
      }
      catch {
      }
    }
    await delay(220)
  }
  return false
}

export async function readClassName(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }

  return (await element.attribute('class') ?? '')
    .trim()
    .replace(WHITESPACE_RE, ' ')
}

function escapeRegExp(value: string) {
  return value.replace(REGEXP_ESCAPE_RE, '\\$&')
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASH_RE, '')
}

function formatDebugSnippet(value: string | null | undefined, maxLength = 160) {
  if (!value) {
    return '<empty>'
  }
  const normalized = value.replace(WHITESPACE_RE, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength)}...`
}

export async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
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
    }
    await delay(220)
  }
  return null
}

async function waitForRouteReady(miniProgram: any, route: string, readyText?: string, timeoutMs = 20_000) {
  const normalizedExpectedPath = normalizeRoutePath(route)
  const start = Date.now()
  let lastPath = ''
  let lastWxmlSnippet = ''

  while (Date.now() - start <= timeoutMs) {
    try {
      const currentPage = await miniProgram.currentPage()
      lastPath = normalizeRoutePath(currentPage?.path ?? '')
      if (lastPath === normalizedExpectedPath) {
        try {
          lastWxmlSnippet = formatDebugSnippet(await readPageWxml(currentPage))
        }
        catch {
        }
        const ready = await waitForPageWxml(currentPage, readyText, 800)
        if (ready) {
          return currentPage
        }
      }
    }
    catch {
    }
    await delay(220)
  }

  process.stdout.write(
    `[github-issues:relaunch] timeout route=${route} lastPath=${lastPath || '<none>'} readyText=${readyText || '<none>'} lastWxml=${lastWxmlSnippet || '<unavailable>'}\n`,
  )
  return null
}

export async function relaunchPage(miniProgram: any, route: string, readyText?: string, timeoutMs = 20_000) {
  async function runAttempts(targetMiniProgram: any, phase: 'primary' | 'restart') {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      process.stdout.write(`[github-issues:relaunch] phase=${phase} route=${route} attempt=${attempt + 1}/4\n`)
      let page: any = null
      try {
        page = await targetMiniProgram.reLaunch(route)
      }
      catch {
        await delay(280)
        continue
      }
      if (!page) {
        await delay(220)
        continue
      }

      const readyPage = await waitForRouteReady(targetMiniProgram, route, readyText, timeoutMs)
      if (readyPage) {
        return readyPage
      }
      await delay(220)
    }

    return null
  }

  const primaryPage = await runAttempts(miniProgram, 'primary')
  if (primaryPage) {
    return primaryPage
  }

  if (miniProgram === sharedMiniProgram) {
    process.stdout.write(`[github-issues:relaunch] restart shared automator route=${route}\n`)
    const restartedMiniProgram = await restartSharedMiniProgram()
    return await runAttempts(restartedMiniProgram, 'restart')
  }

  return null
}

export function expectPropsProbeCase(
  wxml: string,
  options: { caseId: string, boolText: 'true' | 'false', strText: string },
) {
  const { caseId, boolText, strText } = options
  const casePattern = escapeRegExp(caseId)
  const boolPattern = escapeRegExp(boolText)
  const strPattern = escapeRegExp(strText)

  const destructuredPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-destructured[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-destructured-bool="${boolPattern}")(?=[^>]*data-destructured-str="${strPattern}")[^>]*>`,
  )
  const propsPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-props[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-props-bool="${boolPattern}")(?=[^>]*data-props-bool-raw="${boolPattern}")(?=[^>]*data-props-str="${strPattern}")[^>]*>`,
  )
  const strictPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-strict-probe[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-strict-bool="${boolPattern}")(?=[^>]*data-strict-bool-raw="${boolPattern}")(?=[^>]*data-strict-str="${strPattern}")[^>]*>`,
  )

  expect(wxml).toMatch(destructuredPattern)
  expect(wxml).toMatch(propsPattern)
  expect(wxml).toMatch(strictPattern)
}

function normalizeClassValue(className: string) {
  return className.trim().replace(WHITESPACE_RE, ' ')
}

export function readFirstClassFromWxmlByToken(wxml: string, token: string) {
  const escapedToken = escapeRegExp(token)
  const pattern = new RegExp(`<[^>]*\\bclass=(['"])([^'"]*\\b${escapedToken}\\b[^'"]*)\\1[^>]*>`, 'i')
  const className = pattern.exec(wxml)?.[2] ?? ''
  return normalizeClassValue(className)
}

export async function tapControlAndReadClass(page: any, tapSelector: string, classSelector = tapSelector) {
  const controlElement = await page.$(tapSelector)
  if (!controlElement) {
    throw new Error(`Failed to find tap element: ${tapSelector}`)
  }

  const beforeClass = await readClassName(page, classSelector)

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await controlElement.tap()
      return
    }
    if (mode === 'trigger') {
      await controlElement.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await controlElement.touchstart()
      await controlElement.touchend()
      return
    }
    await controlElement.dispatchEvent({ eventName: 'tap' })
  }

  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    for (let index = 0; index < 2; index += 1) {
      try {
        await fireTapLikeEvent(mode)
      }
      catch {
      }
      await page.waitFor(220)
      const currentClass = await readClassName(page, classSelector)
      if (currentClass !== beforeClass) {
        return currentClass
      }
    }
  }

  return readClassName(page, classSelector)
}

export async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find tap element: ${selector}`)
  }

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await element.tap()
      return
    }
    if (mode === 'trigger') {
      await element.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await element.touchstart()
      await element.touchend()
      return
    }
    await element.dispatchEvent({ eventName: 'tap' })
  }

  let lastError: unknown
  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    try {
      await fireTapLikeEvent(mode)
      await page.waitFor(240)
      return
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to tap element: ${selector}`)
}
