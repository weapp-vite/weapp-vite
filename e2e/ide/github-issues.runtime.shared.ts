import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

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

async function launchGithubIssuesMiniProgram(ctx?: { skip: (message?: string) => void }) {
  if (sharedLaunchInfraUnavailableMessage) {
    ctx?.skip(sharedLaunchInfraUnavailableMessage)
    throw new Error(sharedLaunchInfraUnavailableMessage)
  }

  await cleanupResidualIdeProcesses()

  if (!sharedBuildPrepared) {
    // 同一路径重复打开 github-issues 项目时，微信开发者工具可能沿用旧 compile cache /
    // fileutils 状态，先消费旧 app.json，再去索引新的页面产物，出现“app.json 指向的 wxml 未找到”。
    await cleanDevtoolsCache('all', { cwd: APP_ROOT })
    await runBuild()
    sharedBuildPrepared = true
  }

  try {
    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
    await delay(1_200)
    return miniProgram
  }
  catch (error) {
    if (ctx && isDevtoolsHttpPortError(error)) {
      sharedLaunchInfraUnavailableMessage = 'WeChat DevTools 基础设施不可用，跳过 github-issues IDE 自动化用例。'
      ctx.skip(sharedLaunchInfraUnavailableMessage)
    }
    throw error
  }
}

export async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await closeMiniProgramSafely(miniProgram)
}

export async function getSharedMiniProgram(ctx?: { skip: (message?: string) => void }) {
  await closeSharedMiniProgram()
  sharedMiniProgram = await launchGithubIssuesMiniProgram(ctx)
  return sharedMiniProgram
}

export async function launchFreshMiniProgram(ctx?: { skip: (message?: string) => void }) {
  return await launchGithubIssuesMiniProgram(ctx)
}

export async function releaseSharedMiniProgram(miniProgram: any) {
  if (sharedMiniProgram === miniProgram) {
    sharedMiniProgram = null
  }
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
  return await runAutomatorOp('read page wxml', async () => {
    const element = await page.$('page')
    if (!element) {
      throw new Error('Failed to find page element')
    }
    return stripAutomatorOverlay(await element.wxml())
  }, {
    timeoutMs: 5_000,
    retries: 2,
    retryDelayMs: 180,
  })
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
  return await runAutomatorOp(`read class ${selector}`, async () => {
    const element = await page.$(selector)
    if (!element) {
      throw new Error(`Failed to find element: ${selector}`)
    }

    return (await element.attribute('class') ?? '')
      .trim()
      .replace(WHITESPACE_RE, ' ')
  }, {
    timeoutMs: 5_000,
    retries: 2,
    retryDelayMs: 180,
  })
}

function escapeRegExp(value: string) {
  return value.replace(REGEXP_ESCAPE_RE, '\\$&')
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASH_RE, '')
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

export async function relaunchPage(miniProgram: any, route: string, readyText?: string, timeoutMs = 45_000) {
  async function runAttempts(targetMiniProgram: any, phase: 'primary' | 'restart') {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      process.stdout.write(`[github-issues:relaunch] phase=${phase} route=${route} attempt=${attempt + 1}/4\n`)
      let page: any = null
      try {
        page = await runAutomatorOp(`reLaunch ${route}`, () => targetMiniProgram.reLaunch(route), {
          timeoutMs,
          retries: 1,
        })
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stdout.write(`[github-issues:relaunch] error route=${route} phase=${phase} attempt=${attempt + 1} message=${message}\n`)
        await delay(280)
        continue
      }
      if (!page) {
        await delay(220)
        continue
      }

      const currentPage = await waitForCurrentPagePath(
        targetMiniProgram,
        route,
        Math.min(timeoutMs, 4_000),
      )
      const targetPage = currentPage ?? page
      const ready = targetPage
        ? await waitForPageWxml(targetPage, readyText, timeoutMs)
        : false
      if (ready) {
        return targetPage
      }
      process.stdout.write(`[github-issues:relaunch] ready-timeout route=${route} readyText=${readyText || '<none>'} currentPage=${currentPage?.path || '<none>'} fallback=returned-page\n`)
      return targetPage
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
  return await runAutomatorOp(`tap and read class ${tapSelector}`, async () => {
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

    return await readClassName(page, classSelector)
  }, {
    timeoutMs: 8_000,
    retries: 2,
    retryDelayMs: 180,
  })
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
