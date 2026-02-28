import type { AutomatorSessionOptions, MiniProgramLike, MiniProgramPage } from './automator-session'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import { i18nText } from '../i18n'
import logger, { colors } from '../logger'
import {

  withMiniProgram,
} from './automator-session'

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

export async function navigateTo(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在跳转到 ${colors.cyan(options.url)}...`, `Navigating to ${colors.cyan(options.url)}...`),
    i18nText(`已跳转到 ${colors.cyan(options.url)}`, `Navigated to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.navigateTo(options.url),
  )
}

export async function redirectTo(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在重定向到 ${colors.cyan(options.url)}...`, `Redirecting to ${colors.cyan(options.url)}...`),
    i18nText(`已重定向到 ${colors.cyan(options.url)}`, `Redirected to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.redirectTo(options.url),
  )
}

export async function navigateBack(options: AutomatorCommandOptions) {
  await runRouteCommand(
    options,
    i18nText('正在返回上一页...', 'Navigating back...'),
    i18nText('已返回上一页', 'Navigated back'),
    miniProgram => miniProgram.navigateBack(),
  )
}

export async function reLaunch(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在重启到 ${colors.cyan(options.url)}...`, `Relaunching to ${colors.cyan(options.url)}...`),
    i18nText(`已重启到 ${colors.cyan(options.url)}`, `Relaunched to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.reLaunch(options.url),
  )
}

export async function switchTab(options: NavigateOptions) {
  await runRouteCommand(
    options,
    i18nText(`正在切换 tab 到 ${colors.cyan(options.url)}...`, `Switching tab to ${colors.cyan(options.url)}...`),
    i18nText(`已切换 tab 到 ${colors.cyan(options.url)}`, `Switched tab to ${colors.cyan(options.url)}`),
    miniProgram => miniProgram.switchTab(options.url),
  )
}

export async function pageStack(options: PageInfoOptions) {
  return withMiniProgram(options, async (miniProgram) => {
    const stack = await miniProgram.pageStack()
    const result = stack.map(toPageSnapshot)
    printStructuredResult(result, options.json, i18nText('页面栈：', 'Page stack:'))
    return result
  })
}

export async function currentPage(options: PageInfoOptions) {
  return withMiniProgram(options, async (miniProgram) => {
    const result = toPageSnapshot(await miniProgram.currentPage())
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

export async function systemInfo(options: PageInfoOptions) {
  return withMiniProgram(options, async (miniProgram) => {
    const info = await miniProgram.systemInfo()
    printStructuredResult(info, options.json, i18nText('系统信息：', 'System info:'))
    return info
  })
}

export async function pageData(options: PageDataOptions) {
  return withMiniProgram(options, async (miniProgram) => {
    const page = await miniProgram.currentPage()
    const data = await page.data(options.path)
    printStructuredResult(data, options.json, i18nText('页面数据：', 'Page data:'))
    return data
  })
}

export async function tap(options: TapOptions) {
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText(
      `正在点击元素 ${colors.cyan(options.selector)}...`,
      `Tapping element ${colors.cyan(options.selector)}...`,
    ))
    const page = await miniProgram.currentPage()
    const element = await requireElement(page, options.selector)
    await element.tap()
    logger.success(i18nText(
      `已点击元素 ${colors.cyan(options.selector)}`,
      `Tapped element ${colors.cyan(options.selector)}`,
    ))
  })
}

export async function input(options: InputOptions) {
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText(
      `正在向 ${colors.cyan(options.selector)} 输入 "${colors.cyan(options.value)}"...`,
      `Inputting "${colors.cyan(options.value)}" into ${colors.cyan(options.selector)}...`,
    ))
    const page = await miniProgram.currentPage()
    const element = await requireElement(page, options.selector)

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

export async function audit(options: AuditOptions) {
  return withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText('正在执行体验审计...', 'Running experience audit...'))
    const result = await miniProgram.stopAudits()

    if (options.outputPath) {
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

export async function takeScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
  return withMiniProgram(options, async (miniProgram) => {
    logger.info(i18nText(
      `正在连接 DevTools：${colors.cyan(options.projectPath)}...`,
      `Connecting to DevTools at ${colors.cyan(options.projectPath)}...`,
    ))

    if (options.page) {
      logger.info(i18nText(
        `正在跳转页面 ${colors.cyan(options.page)}...`,
        `Navigating to page ${colors.cyan(options.page)}...`,
      ))
      await miniProgram.reLaunch(options.page)
    }

    logger.info(i18nText('正在截图...', 'Taking screenshot...'))
    const screenshot = await miniProgram.screenshot()
    const base64 = typeof screenshot === 'string' ? screenshot : Buffer.from(screenshot).toString('base64')

    if (!base64) {
      throw new Error(i18nText('截图失败', 'Failed to capture screenshot'))
    }

    if (options.outputPath) {
      await fs.writeFile(options.outputPath, Buffer.from(base64, 'base64'))
      logger.success(i18nText(
        `截图已保存到 ${colors.cyan(options.outputPath)}`,
        `Screenshot saved to ${colors.cyan(options.outputPath)}`,
      ))
      return { path: options.outputPath }
    }

    return { base64 }
  })
}

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

async function runRouteCommand(
  options: AutomatorCommandOptions,
  startMessage: string,
  successMessage: string,
  run: (miniProgram: MiniProgramLike) => Promise<unknown>,
) {
  await withMiniProgram(options, async (miniProgram) => {
    logger.info(startMessage)
    await run(miniProgram)
    logger.success(successMessage)
  })
}

function toPageSnapshot(page: MiniProgramPage): PageSnapshot {
  return {
    path: page.path ?? '',
    query: page.query,
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

async function requireElement(page: MiniProgramPage, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(i18nText(`未找到元素: ${selector}`, `Element not found: ${selector}`))
  }
  return element
}
