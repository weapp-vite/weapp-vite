import type { Element, MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import { i18nText } from '../i18n'
import logger from '../logger'
import {
  connectOpenedAutomator,
  formatAutomatorLoginError,
  getAutomatorProtocolTimeoutMethod,
  isAutomatorLoginError,
  isAutomatorProtocolTimeoutError,
  isAutomatorWsConnectError,
  isDevtoolsExtensionContextInvalidatedError,
  isDevtoolsHttpPortError,
  launchAutomator,
} from './automator'

export interface MiniProgramEventMap {
  console: (payload: unknown) => void
  exception: (payload: unknown) => void
}

export type MiniProgramLike = InstanceType<typeof MiniProgram>
export type MiniProgramPage = InstanceType<typeof Page>
export type MiniProgramElement = InstanceType<typeof Element> & {
  input?: (value: string) => Promise<void>
}

export interface AutomatorSessionOptions {
  miniProgram?: MiniProgramLike
  preferOpenedSession?: boolean
  projectPath: string
  sharedSession?: boolean
  timeout?: number
}

interface SharedMiniProgramSessionEntry {
  refs: number
  session: Promise<MiniProgramLike>
}

const sharedMiniProgramSessions = new Map<string, SharedMiniProgramSessionEntry>()

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

  if (isAutomatorProtocolTimeoutError(error)) {
    const method = getAutomatorProtocolTimeoutMethod(error) ?? 'unknown'
    logger.error(i18nText(
      `微信开发者工具在协议调用 ${method} 上超时，未按预期返回结果。`,
      `Wechat DevTools timed out while executing protocol method ${method} and did not return a result.`,
    ))
    logger.warn(i18nText(
      '这通常表示当前 DevTools 自动化会话已卡住、窗口不在目标项目、或当前 DevTools 版本对该协议调用无响应。请重开目标项目窗口后重试；若仍复现，优先记录当前 DevTools 版本与协议方法名继续排查。',
      'This usually means the current DevTools automation session is stuck, the window is not on the target project, or the current DevTools version is not responding to that protocol method. Reopen the target project window and retry. If it still reproduces, record the current DevTools version and protocol method name for follow-up debugging.',
    ))
    return new Error('DEVTOOLS_PROTOCOL_TIMEOUT')
  }

  return error instanceof Error ? error : new Error(String(error))
}

/**
 * @description 建立 automator 会话，并统一处理常见连接错误提示。
 */
export async function connectMiniProgram(options: AutomatorSessionOptions): Promise<MiniProgramLike> {
  if (options.preferOpenedSession === false) {
    try {
      return await launchAutomator(options) as MiniProgramLike
    }
    catch (error) {
      throw normalizeMiniProgramConnectionError(error)
    }
  }

  try {
    return await connectOpenedAutomator(options) as MiniProgramLike
  }
  catch (error) {
    const normalizedOpenSessionError = normalizeMiniProgramConnectionError(error)
    if (normalizedOpenSessionError instanceof Error && normalizedOpenSessionError.message === 'DEVTOOLS_PROTOCOL_TIMEOUT') {
      throw normalizedOpenSessionError
    }

    try {
      return await launchAutomator(options) as MiniProgramLike
    }
    catch (launchError) {
      throw normalizeMiniProgramConnectionError(launchError)
    }
  }
}

/**
 * @description 获取指定项目的共享 automator 会话；若不存在则自动创建。
 */
export async function acquireSharedMiniProgram(options: AutomatorSessionOptions): Promise<MiniProgramLike> {
  const existing = sharedMiniProgramSessions.get(options.projectPath)
  if (existing) {
    existing.refs += 1
    return await existing.session
  }

  const session = connectMiniProgram(options)
  const entry: SharedMiniProgramSessionEntry = {
    refs: 1,
    session,
  }
  sharedMiniProgramSessions.set(options.projectPath, entry)

  try {
    return await session
  }
  catch (error) {
    sharedMiniProgramSessions.delete(options.projectPath)
    throw error
  }
}

/**
 * @description 释放指定项目的共享会话引用；会话对象会继续缓存，直到显式关闭或重置。
 */
export function releaseSharedMiniProgram(projectPath: string) {
  const entry = sharedMiniProgramSessions.get(projectPath)
  if (!entry) {
    return
  }
  entry.refs = Math.max(0, entry.refs - 1)
}

/**
 * @description 关闭并移除指定项目的共享 automator 会话。
 */
export async function closeSharedMiniProgram(projectPath: string) {
  const entry = sharedMiniProgramSessions.get(projectPath)
  if (!entry) {
    return
  }
  sharedMiniProgramSessions.delete(projectPath)
  const miniProgram = await entry.session.catch(() => null)
  miniProgram?.disconnect()
}

/**
 * @description 获取当前共享会话数量，供测试断言使用。
 */
export function getSharedMiniProgramSessionCount() {
  return sharedMiniProgramSessions.size
}

/**
 * @description 统一管理 automator 会话生命周期。
 */
export async function withMiniProgram<T>(
  options: AutomatorSessionOptions,
  runner: (miniProgram: MiniProgramLike) => Promise<T>,
): Promise<T> {
  if (options.miniProgram) {
    return await runner(options.miniProgram)
  }

  if (options.sharedSession) {
    const miniProgram = await acquireSharedMiniProgram(options)

    try {
      return await runner(miniProgram)
    }
    catch (error) {
      await closeSharedMiniProgram(options.projectPath)
      throw normalizeMiniProgramConnectionError(error)
    }
    finally {
      releaseSharedMiniProgram(options.projectPath)
    }
  }

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
