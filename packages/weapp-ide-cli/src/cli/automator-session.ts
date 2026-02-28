import type { Buffer } from 'node:buffer'
import { i18nText } from '../i18n'
import logger from '../logger'
import {
  formatAutomatorLoginError,
  isAutomatorLoginError,
  isDevtoolsHttpPortError,
  launchAutomator,
} from './automator'

export interface AutomatorSessionOptions {
  projectPath: string
  timeout?: number
}

export interface MiniProgramElement {
  tap: () => Promise<void>
  input?: (value: string) => Promise<void>
}

export interface MiniProgramPage {
  path?: string
  query?: Record<string, unknown>
  data: (path?: string) => Promise<unknown>
  $: (selector: string) => Promise<MiniProgramElement | null>
}

export interface MiniProgramLike {
  navigateTo: (url: string) => Promise<unknown>
  redirectTo: (url: string) => Promise<unknown>
  navigateBack: () => Promise<unknown>
  reLaunch: (url: string) => Promise<unknown>
  switchTab: (url: string) => Promise<unknown>
  pageStack: () => Promise<MiniProgramPage[]>
  currentPage: () => Promise<MiniProgramPage>
  systemInfo: () => Promise<unknown>
  pageScrollTo: (scrollTop: number) => Promise<unknown>
  stopAudits: () => Promise<unknown>
  screenshot: () => Promise<string | Buffer>
  remote: (enable?: boolean) => Promise<unknown>
  close: () => Promise<void>
}

/**
 * @description 统一管理 automator 会话生命周期与常见连接错误提示。
 */
export async function withMiniProgram<T>(
  options: AutomatorSessionOptions,
  runner: (miniProgram: MiniProgramLike) => Promise<T>,
): Promise<T> {
  let miniProgram: MiniProgramLike | null = null

  try {
    miniProgram = await launchAutomator(options) as MiniProgramLike
    return await runner(miniProgram)
  }
  catch (error) {
    if (isAutomatorLoginError(error)) {
      logger.error(i18nText(
        '检测到微信开发者工具登录状态失效，请先登录后重试。',
        'Wechat DevTools login has expired. Please login and retry.',
      ))
      logger.warn(formatAutomatorLoginError(error))
      throw new Error('DEVTOOLS_LOGIN_REQUIRED')
    }

    if (isDevtoolsHttpPortError(error)) {
      logger.error(i18nText(
        '无法连接到微信开发者工具，请确保已开启 HTTP 服务端口。',
        'Cannot connect to Wechat DevTools. Please ensure HTTP service port is enabled.',
      ))
      logger.warn(i18nText(
        '请在微信开发者工具中：设置 -> 安全设置 -> 开启服务端口',
        'Please enable service port in Wechat DevTools: Settings -> Security -> Service Port',
      ))
      throw new Error('DEVTOOLS_HTTP_PORT_ERROR')
    }

    throw error
  }
  finally {
    if (miniProgram) {
      await miniProgram.close()
    }
  }
}
