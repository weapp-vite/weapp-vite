import type { Element, MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
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

export interface MiniProgramEventMap {
  console: (payload: unknown) => void
  exception: (payload: unknown) => void
}

export type MiniProgramLike = InstanceType<typeof MiniProgram>
export type MiniProgramPage = InstanceType<typeof Page>
export type MiniProgramElement = InstanceType<typeof Element> & {
  input?: (value: string) => Promise<void>
}

function normalizeMiniProgramConnectionError(error: unknown) {
  if (isAutomatorLoginError(error)) {
    logger.error(i18nText(
      '检测到微信开发者工具登录状态失效，请先登录后重试。',
      'Wechat DevTools login has expired. Please login and retry.',
    ))
    logger.warn(formatAutomatorLoginError(error))
    return new Error('DEVTOOLS_LOGIN_REQUIRED')
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
    return new Error('DEVTOOLS_HTTP_PORT_ERROR')
  }

  return error instanceof Error ? error : new Error(String(error))
}

/**
 * @description 建立 automator 会话，并统一处理常见连接错误提示。
 */
export async function connectMiniProgram(options: AutomatorSessionOptions): Promise<MiniProgramLike> {
  try {
    return await launchAutomator(options) as MiniProgramLike
  }
  catch (error) {
    throw normalizeMiniProgramConnectionError(error)
  }
}

/**
 * @description 统一管理 automator 会话生命周期。
 */
export async function withMiniProgram<T>(
  options: AutomatorSessionOptions,
  runner: (miniProgram: MiniProgramLike) => Promise<T>,
): Promise<T> {
  let miniProgram: MiniProgramLike | null = null

  try {
    miniProgram = await connectMiniProgram(options)
    return await runner(miniProgram)
  }
  catch (error) {
    throw normalizeMiniProgramConnectionError(error)
  }
  finally {
    if (miniProgram) {
      await miniProgram.close()
    }
  }
}
