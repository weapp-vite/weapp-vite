import type {
  AutomatorElement,
  AutomatorMiniProgram,
  AutomatorPage,
  DevtoolsRuntimeSessionOptions,
  MiniProgramEventMap,
} from '@weapp-vite/devtools-runtime'
import {
  acquireSharedMiniProgram as acquireRuntimeSharedMiniProgram,
  closeSharedMiniProgram,
  getSharedMiniProgramSessionCount,
  releaseSharedMiniProgram,
  withMiniProgram as withRuntimeMiniProgram,
} from '@weapp-vite/devtools-runtime'
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
  resolveProjectAutomatorPort,
} from './automator'
import { createWechatIdeLoginRequiredExitError, promptWechatIdeLoginRetry } from './retry'
import { runRetryableCommand } from './run-login-executor'

export type {
  MiniProgramEventMap,
}

export type MiniProgramLike = AutomatorMiniProgram
export type MiniProgramPage = AutomatorPage
export type MiniProgramElement = AutomatorElement

export interface AutomatorSessionOptions extends DevtoolsRuntimeSessionOptions {}

type AutomatorConnectionResult
  = { kind: 'result', value: MiniProgramLike }
    | { error: unknown, kind: 'retryable' }

function unwrapAutomatorConnectionError(result: AutomatorConnectionResult) {
  return result.kind === 'retryable' ? result.error : result.value
}

async function launchFreshAutomator(options: AutomatorSessionOptions) {
  const shouldUseProjectPort = !options.port && !options.sessionId
  return await launchAutomator({
    ...options,
    ...(shouldUseProjectPort
      ? {
          persistAsDefaultSession: true,
          port: resolveProjectAutomatorPort(options.projectPath),
        }
      : {}),
  }) as MiniProgramLike
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
      'Please confirm the current DevTools window is the target project. If you recently ran other e2e / screenshot tasks, close extra windows or stop stale `wechatwebdevtools cli auto --project ...` processes and retry.',
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
  const result = await runRetryableCommand<AutomatorConnectionResult, 'retry' | 'cancel' | 'timeout'>({
    createCancelError: result => createWechatIdeLoginRequiredExitError(
      unwrapAutomatorConnectionError(result),
      'cancelled',
    ),
    execute: async () => {
      if (options.preferOpenedSession === false) {
        try {
          return {
            kind: 'result',
            value: await launchFreshAutomator(options),
          } as const
        }
        catch (error) {
          if (!isAutomatorLoginError(error)) {
            throw normalizeMiniProgramConnectionError(error)
          }
          return {
            error,
            kind: 'retryable',
          } as const
        }
      }

      try {
        return {
          kind: 'result',
          value: await connectOpenedAutomator(options) as MiniProgramLike,
        } as const
      }
      catch (error) {
        const normalizedOpenSessionError = normalizeMiniProgramConnectionError(error)
        if (normalizedOpenSessionError instanceof Error && normalizedOpenSessionError.message === 'DEVTOOLS_PROTOCOL_TIMEOUT') {
          throw normalizedOpenSessionError
        }

        try {
          return {
            kind: 'result',
            value: await launchFreshAutomator(options),
          } as const
        }
        catch (launchError) {
          if (!isAutomatorLoginError(launchError)) {
            throw normalizeMiniProgramConnectionError(launchError)
          }
          return {
            error: launchError,
            kind: 'retryable',
          } as const
        }
      }
    },
    isRetryableResult: result => result.kind === 'retryable',
    onRetry: () => {
      logger.info(i18nText('正在重试连接微信开发者工具...', 'Retrying to connect Wechat DevTools...'))
    },
    promptRetry: async result => await promptWechatIdeLoginRetry({
      error: unwrapAutomatorConnectionError(result),
      logger,
      promptOpenIdeLogin: true,
    }),
    shouldRetry: action => action === 'retry',
  })

  if (result.kind === 'retryable') {
    throw createWechatIdeLoginRequiredExitError(result.error)
  }

  return result.value
}

const runtimeHooks = {
  connectMiniProgram,
  normalizeConnectionError: normalizeMiniProgramConnectionError,
}

/**
 * @description 获取指定项目的共享 automator 会话；若不存在则自动创建。
 */
export async function acquireSharedMiniProgram(options: AutomatorSessionOptions): Promise<MiniProgramLike> {
  return await acquireRuntimeSharedMiniProgram(runtimeHooks, options)
}

export {
  closeSharedMiniProgram,
  getSharedMiniProgramSessionCount,
  releaseSharedMiniProgram,
}

/**
 * @description 统一管理 automator 会话生命周期。
 */
export async function withMiniProgram<T>(
  options: AutomatorSessionOptions,
  runner: (miniProgram: MiniProgramLike) => Promise<T>,
): Promise<T> {
  return await withRuntimeMiniProgram(runtimeHooks, options, runner)
}
