import type { Element, MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import { i18nText } from '../i18n'
import logger from '../logger'
import {
  formatAutomatorLoginError,
  isAutomatorLoginError,
  isAutomatorWsConnectError,
  isDevtoolsExtensionContextInvalidatedError,
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

  if (isDevtoolsExtensionContextInvalidatedError(error)) {
    logger.error(i18nText(
      '微信开发者工具自动化上下文尚未就绪，通常是刚启动或正在重载。',
      'Wechat DevTools automation context is not ready yet, usually because the IDE has just started or is still reloading.',
    ))
    logger.warn(i18nText(
      '请稍后重试；若持续失败，关闭多余的开发者工具窗口后重试。',
      'Please retry shortly. If it keeps failing, close extra DevTools windows and try again.',
    ))
    return new Error('DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED')
  }

  if (isAutomatorWsConnectError(error)) {
    logger.error(i18nText(
      '无法连接到当前项目的微信开发者工具自动化 websocket。',
      'Cannot connect to the Wechat DevTools automation websocket for the current project.',
    ))
    logger.warn(i18nText(
      '请确认当前打开的是目标项目；若之前跑过其他 e2e / screenshot 任务，关闭多余的微信开发者工具窗口，或结束残留的 `wechatwebdevtools cli auto --project ...` 进程后重试。',
      'Please confirm the current DevTools window is the target project. If you recently ran other e2e or screenshot tasks, close extra DevTools windows or stop stale `wechatwebdevtools cli auto --project ...` processes and retry.',
    ))
    return new Error('DEVTOOLS_WS_CONNECT_ERROR')
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
