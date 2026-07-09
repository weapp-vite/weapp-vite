import type {
  AutomatorSessionOptions,
  MiniProgramElement,
  MiniProgramLike,
  MiniProgramPage,
} from './automator-session'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { i18nText } from '../i18n'
import logger, { colors } from '../logger'
import {
  closeSharedMiniProgram,
  withMiniProgram,
} from './automator-session'
import { captureFullPageScreenshotBuffer } from './fullPageScreenshot'
import { closeWechatIdeProject } from './wechat-commands'

export interface AutomatorCommandOptions extends AutomatorSessionOptions {}

export interface NavigateOptions extends AutomatorCommandOptions {
  url: string
}

export interface PageInfoOptions extends AutomatorCommandOptions {
  json?: boolean
}

export interface PageDataOptions extends PageInfoOptions {
  path?: string
}

export interface SelectorOptions extends AutomatorCommandOptions {
  selector: string
}

export interface TapOptions extends SelectorOptions {}

export interface InputOptions extends SelectorOptions {
  value: string
}

export interface ScrollOptions extends AutomatorCommandOptions {
  scrollTop: number
}

export interface AuditOptions extends AutomatorCommandOptions {
  outputPath?: string
}

export interface ScreenshotOptions extends AutomatorCommandOptions {
  outputPath?: string
  page?: string
  fullPage?: boolean
  retryWithFreshSession?: boolean
}

export interface ScreenshotResult {
  base64?: string
  path?: string
}

export interface RemoteOptions extends AutomatorCommandOptions {
  enable?: boolean
}

interface PageSnapshot {
  path: string
  query: Record<string, unknown> | undefined
}

function createTimeoutError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

function normalizePagePath(page: string) {
  return page.startsWith('/') ? page : `/${page}`
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function withCommandTimeout<T>(task: Promise<T>, timeoutMs: number, message: string, code: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(createTimeoutError(message, code))
    }, timeoutMs)

    task
      .then((value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

function createCurrentPageTimeoutMessage(commandTimeout: number) {
  return i18nText(
    `当前页面请求在 ${commandTimeout}ms 内未收到 DevTools 回包，请确认当前打开的是目标项目；若之前跑过其他 e2e / screenshot 任务，关闭多余的微信开发者工具窗口，或结束残留的 \`wechatwebdevtools cli auto --project ...\` 进程后重试。`,
    `Current page request did not receive a DevTools response within ${commandTimeout}ms. Please confirm the current DevTools window is the target project. If you recently ran other e2e / screenshot tasks, close extra windows or stop stale \`wechatwebdevtools cli auto --project ...\` processes and retry.`,
  )
}

function isDevtoolsProtocolTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  return error.message === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    || error.message.includes('DevTools did not respond to protocol method')
    || Reflect.get(error, 'code') === 'DEVTOOLS_PROTOCOL_TIMEOUT'
}

function isScreenshotNavigationTimeoutError(error: unknown) {
  return error instanceof Error && Reflect.get(error, 'code') === 'DEVTOOLS_SCREENSHOT_NAVIGATION_TIMEOUT'
}

function isScreenshotRequestTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  return error.message === 'DEVTOOLS_SCREENSHOT_TIMEOUT'
    || Reflect.get(error, 'code') === 'DEVTOOLS_SCREENSHOT_TIMEOUT'
}

function toScreenshotBuffer(screenshot: string | Buffer | undefined) {
  if (screenshot === undefined) {
    return Buffer.alloc(0)
  }
  return typeof screenshot === 'string'
    ? Buffer.from(screenshot, 'base64')
    : Buffer.from(screenshot)
}

async function reLaunchForScreenshot(miniProgram: MiniProgramLike, page: string) {
  const routeOptions = { url: page }
  if (typeof miniProgram.callWxMethod === 'function') {
    await miniProgram.callWxMethod('reLaunch', routeOptions)
  }
  else {
    await miniProgram.reLaunch(page)
  }
}

async function runRouteCommand(
  options: AutomatorCommandOptions,
  startMessage: string,
  successMessage: string,
  action: (miniProgram: MiniProgramLike) => Promise<unknown>,
) {
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(startMessage)
    await action(miniProgram)
    logger.success(successMessage)
  })
}

function toPageSnapshot(page: MiniProgramPage): PageSnapshot {
  return {
    path: page.path ?? '',
    query: page.query as Record<string, unknown> | undefined,
  }
}

function printStructuredResult(result: unknown, json: boolean | undefined, title: string) {
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  logger.info(title)
  console.log(JSON.stringify(result, null, 2))
}

async function requireElement(page: MiniProgramPage, selector: string, timeoutMs = 5_000): Promise<MiniProgramElement> {
  const startedAt = Date.now()
  let lastError: unknown
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const element = await page.$(selector)
      if (element) {
        return element as MiniProgramElement
      }
    }
    catch (error) {
      lastError = error
    }
    await sleep(160)
  }

  const reason = lastError instanceof Error ? ` ${lastError.message}` : ''
  throw new Error(i18nText(`未找到元素: ${selector}${reason}`, `Element not found: ${selector}${reason}`))
}

/**
 * @description 执行保留栈页面跳转。
 */
export async function navigateTo(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在跳转到 ${colors.cyan(options.url)}...`, `Navigating to ${colors.cyan(options.url)}...`),
    i18nText(`已跳转到 ${colors.cyan(options.url)}`, `Navigated to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.navigateTo(options.url),
  )
}

/**
 * @description 执行关闭当前页的重定向。
 */
export async function redirectTo(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在重定向到 ${colors.cyan(options.url)}...`, `Redirecting to ${colors.cyan(options.url)}...`),
    i18nText(`已重定向到 ${colors.cyan(options.url)}`, `Redirected to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.redirectTo(options.url),
  )
}

/**
 * @description 返回上一页。
 */
export async function navigateBack(options: AutomatorCommandOptions) {
  await runRouteCommand(
    options,
    i18nText('正在返回上一页...', 'Navigating back...'),
    i18nText('已返回上一页', 'Navigated back'),
    miniProgram => miniProgram.navigateBack(),
  )
}

/**
 * @description 重启到指定页面。
 */
export async function reLaunch(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在重启到 ${colors.cyan(options.url)}...`, `Relaunching to ${colors.cyan(options.url)}...`),
    i18nText(`已重启到 ${colors.cyan(options.url)}`, `Relaunched to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.reLaunch(options.url),
  )
}

/**
 * @description 切换到 tabBar 页面。
 */
export async function switchTab(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在切换 tab 到 ${colors.cyan(options.url)}...`, `Switching tab to ${colors.cyan(options.url)}...`),
    i18nText(`已切换 tab 到 ${colors.cyan(options.url)}`, `Switched tab to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.switchTab(options.url),
  )
}

/**
 * @description 获取页面栈。
 */
export async function pageStack(options: PageInfoOptions) {
  return await withMiniProgram(options, async (miniProgram) => {
    const result = (await miniProgram.pageStack()).map(toPageSnapshot)
    printStructuredResult(result, options.json, i18nText('页面栈：', 'Page stack:'))
    return result
  })
}

/**
 * @description 获取当前页面信息。
 */
export async function currentPage(options: PageInfoOptions) {
  return await withMiniProgram(options, async (miniProgram) => {
    const commandTimeout = options.timeout ?? 30_000
    const page = await withCommandTimeout(
      miniProgram.currentPage(),
      commandTimeout,
      createCurrentPageTimeoutMessage(commandTimeout),
      'DEVTOOLS_PROTOCOL_TIMEOUT',
    )
    const result = toPageSnapshot(page)
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    }
    else {
      logger.info(i18nText(
        `当前页面: ${result.path}${result.query ? ` ${JSON.stringify(result.query)}` : ''}`,
        `Current page: ${result.path}${result.query ? ` ${JSON.stringify(result.query)}` : ''}`,
      ))
    }
    return result
  })
}

/**
 * @description 获取系统信息。
 */
export async function systemInfo(options: PageInfoOptions) {
  return await withMiniProgram(options, async (miniProgram) => {
    const result = await miniProgram.systemInfo()
    printStructuredResult(result, options.json, i18nText('系统信息：', 'System info:'))
    return result
  })
}

/**
 * @description 获取当前页面数据。
 */
export async function pageData(options: PageDataOptions) {
  return await withMiniProgram(options, async (miniProgram) => {
    const page = await miniProgram.currentPage()
    const result = await page.data(options.path)
    printStructuredResult(result, options.json, i18nText('页面数据：', 'Page data:'))
    return result
  })
}

/**
 * @description 点击页面元素。
 */
export async function tap(options: TapOptions) {
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText(
      `正在点击元素 ${colors.cyan(options.selector)}...`,
      `Tapping element ${colors.cyan(options.selector)}...`,
    ))
    const commandTimeout = options.timeout ?? 30_000
    const page = await miniProgram.currentPage()
    const element = await requireElement(page, options.selector, commandTimeout)
    await element.tap()
    logger.success(i18nText(
      `已点击元素 ${colors.cyan(options.selector)}`,
      `Tapped element ${colors.cyan(options.selector)}`,
    ))
  })
}

/**
 * @description 向页面元素输入文本。
 */
export async function input(options: InputOptions) {
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText(
      `正在向 ${colors.cyan(options.selector)} 输入 "${colors.cyan(options.value)}"...`,
      `Inputting "${colors.cyan(options.value)}" into ${colors.cyan(options.selector)}...`,
    ))
    const commandTimeout = options.timeout ?? 30_000
    const page = await miniProgram.currentPage()
    const element = await requireElement(page, options.selector, commandTimeout)

    if (typeof element.input !== 'function') {
      throw new TypeError(i18nText(
        `元素不支持输入: ${options.selector}`,
        `Element does not support input: ${options.selector}`,
      ))
    }

    await element.input(options.value)
    logger.success(i18nText(
      `已向 ${colors.cyan(options.selector)} 输入 "${colors.cyan(options.value)}"`,
      `Inputted "${colors.cyan(options.value)}" into ${colors.cyan(options.selector)}`,
    ))
  })
}

/**
 * @description 滚动页面到指定位置。
 */
export async function scrollTo(options: ScrollOptions) {
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText(
      `正在滚动到位置 ${colors.cyan(String(options.scrollTop))}...`,
      `Scrolling to position ${colors.cyan(String(options.scrollTop))}...`,
    ))
    await miniProgram.pageScrollTo(options.scrollTop)
    logger.success(i18nText(
      `已滚动到位置 ${colors.cyan(String(options.scrollTop))}`,
      `Scrolled to position ${colors.cyan(String(options.scrollTop))}`,
    ))
  })
}

/**
 * @description 执行体验评分审计。
 */
export async function audit(options: AuditOptions) {
  return await withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText('正在执行体验审计...', 'Running experience audit...'))
    const result = await miniProgram.stopAudits()

    if (options.outputPath) {
      await fs.mkdir(path.dirname(options.outputPath), { recursive: true })
      await fs.writeFile(options.outputPath, JSON.stringify(result, null, 2))
      logger.success(i18nText(
        `审计报告已保存到 ${colors.cyan(options.outputPath)}`,
        `Audit report saved to ${colors.cyan(options.outputPath)}`,
      ))
      return result
    }

    console.log(JSON.stringify(result, null, 2))
    return result
  })
}

/**
 * @description 捕获当前页面截图并返回二进制内容。
 */
export async function captureScreenshotBuffer(options: ScreenshotOptions): Promise<Buffer> {
  return await withMiniProgram(options, async (miniProgram) => {
    const commandTimeout = options.timeout ?? 30_000
    const screenshotTimeoutMessage = i18nText(
      `截图请求在 ${commandTimeout}ms 内未收到 DevTools 回包，请检查当前微信开发者工具是否仍停留在目标项目；若近期执行过其他 e2e / screenshot 任务，关闭多余窗口并清理残留 automator 会话后重试。`,
      `Screenshot request did not receive a DevTools response within ${commandTimeout}ms. Check that the current Wechat DevTools window is still the target project. If you recently ran other e2e or screenshot tasks, close extra windows and clean up stale automator sessions before retrying.`,
    )

    if (!options.miniProgram) {
      logger.info(i18nText(
        `正在连接 DevTools：${colors.cyan(options.projectPath)}...`,
        `Connecting to DevTools at ${colors.cyan(options.projectPath)}...`,
      ))
    }

    if (options.page) {
      const normalizedPage = normalizePagePath(options.page)
      logger.info(i18nText(
        `正在跳转页面 ${colors.cyan(normalizedPage)}...`,
        `Navigating to page ${colors.cyan(normalizedPage)}...`,
      ))
      try {
        await reLaunchForScreenshot(miniProgram, normalizedPage)
      }
      catch (error) {
        if (!isDevtoolsProtocolTimeoutError(error)) {
          throw error
        }
        logger.warn(i18nText(
          `截图前跳转页面 ${normalizedPage} 超时，将重建会话后截取当前页面。`,
          `Timed out navigating to ${normalizedPage} before screenshot. Rebuilding the session and capturing the current page.`,
        ))
        throw createTimeoutError(
          i18nText(
            `截图前跳转页面 ${normalizedPage} 超时`,
            `Timed out navigating to ${normalizedPage} before screenshot`,
          ),
          'DEVTOOLS_SCREENSHOT_NAVIGATION_TIMEOUT',
        )
      }
      if (options.fullPage) {
        await sleep(1000)
      }
    }

    if (options.fullPage) {
      logger.info(i18nText('正在生成整页长截图...', 'Capturing full-page screenshot...'))
      return await captureFullPageScreenshotBuffer({
        miniProgram,
        timeoutMs: commandTimeout,
        runWithTimeout: withCommandTimeout,
        screenshotTimeoutMessage,
      })
    }

    logger.info(i18nText('正在截图...', 'Taking screenshot...'))
    const screenshot = await withCommandTimeout(
      miniProgram.screenshot({ timeout: commandTimeout }),
      commandTimeout,
      screenshotTimeoutMessage,
      'DEVTOOLS_SCREENSHOT_TIMEOUT',
    )
    const buffer = toScreenshotBuffer(screenshot)

    if (buffer.length === 0) {
      throw new Error(i18nText('截图失败', 'Failed to capture screenshot'))
    }

    return buffer
  })
}

/**
 * @description 获取当前小程序截图。
 */
export async function takeScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
  let nextOptions = options
  let screenshotBuffer: Buffer | undefined
  let hasRetriedWithFreshSession = false

  while (true) {
    try {
      screenshotBuffer = await captureScreenshotBuffer(nextOptions)
      break
    }
    catch (error) {
      const isProtocolTimeout = error instanceof Error && error.message === 'DEVTOOLS_PROTOCOL_TIMEOUT'
      const isNavigationTimeout = isScreenshotNavigationTimeoutError(error)
      const isScreenshotTimeout = isScreenshotRequestTimeoutError(error)
      const canRetryWithFreshSession = Boolean(
        nextOptions.retryWithFreshSession !== false
        && !nextOptions.miniProgram
        && (isProtocolTimeout || isNavigationTimeout || isScreenshotTimeout)
        && !hasRetriedWithFreshSession,
      )

      if (!canRetryWithFreshSession) {
        throw error
      }

      hasRetriedWithFreshSession = true
      await closeWechatIdeProject().catch((closeError) => {
        logger.warn(i18nText(
          `关闭当前微信开发者工具项目窗口失败：${closeError instanceof Error ? closeError.message : String(closeError)}，仍将继续尝试重建自动化会话。`,
          `Failed to close the current Wechat DevTools project window: ${closeError instanceof Error ? closeError.message : String(closeError)}. Continuing to rebuild the automation session.`,
        ))
      })
      const sessionIdOrPort = nextOptions.sessionId || nextOptions.port
      if (sessionIdOrPort) {
        await closeSharedMiniProgram(nextOptions.projectPath, sessionIdOrPort)
      }
      else {
        await closeSharedMiniProgram(nextOptions.projectPath)
      }
      logger.warn(i18nText(
        '当前 DevTools 会话截图超时，正在改用全新自动化会话重试一次...',
        'The current DevTools session timed out while capturing screenshot. Retrying once with a fresh automation session...',
      ))

      const { page: _page, ...optionsWithoutPage } = nextOptions
      nextOptions = {
        ...(isNavigationTimeout ? optionsWithoutPage : nextOptions),
        preferOpenedSession: false,
        sharedSession: false,
      }
    }
  }

  if (!screenshotBuffer) {
    throw new Error(i18nText('截图失败', 'Failed to capture screenshot'))
  }

  const base64 = screenshotBuffer.toString('base64')

  if (options.outputPath) {
    await fs.mkdir(path.dirname(options.outputPath), { recursive: true })
    await fs.writeFile(options.outputPath, screenshotBuffer)
    logger.success(i18nText(
      `截图已保存到 ${colors.cyan(options.outputPath)}`,
      `Screenshot saved to ${colors.cyan(options.outputPath)}`,
    ))
    return { path: options.outputPath }
  }

  return { base64 }
}

/**
 * @description 开关远程调试。
 */
export async function remote(options: RemoteOptions) {
  const enable = options.enable ?? true
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(enable
      ? i18nText('正在开启远程调试...', 'Enabling remote debugging...')
      : i18nText('正在关闭远程调试...', 'Disabling remote debugging...'))
    await miniProgram.remote(enable)
    logger.success(enable
      ? i18nText('远程调试已开启', 'Remote debugging enabled')
      : i18nText('远程调试已关闭', 'Remote debugging disabled'))
  })
}
