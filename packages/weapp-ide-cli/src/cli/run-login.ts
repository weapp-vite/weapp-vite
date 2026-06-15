import type { LoginRetryConfig } from './run-login-config'
import process from 'node:process'
import { i18nText } from '../i18n'
import logger from '../logger'
import { execute } from '../utils'
import { runWithSuspendedSharedInput } from './inputCoordinator'
import {
  createWechatIdeLoginRequiredExitError,
  isWechatIdeLoginRequiredError,
  promptWechatIdeLoginRetry,
} from './retry'
import { resolveLoginRetryConfig } from './run-login-config'
import { runRetryableCommand } from './run-login-executor'
import { setRuntimeWechatDevtoolsServicePort } from './wechatDevtoolsRuntimePort'

type WechatCliExecutionResult
  = { kind: 'result', value: unknown }
    | { error: unknown, kind: 'retryable' }

const IDE_SERVER_STARTED_RE = /IDE server has started,\s*listening on\s+https?:\/\/127\.0\.0\.1:(\d+)/i

function unwrapWechatCliExecutionError(result: WechatCliExecutionResult) {
  return result.kind === 'retryable' ? result.error : result.value
}

async function promptLoginRetry(errorLike: unknown, options: LoginRetryConfig, retryCount: number) {
  const { nonInteractive, retryMode, retryTimeoutMs } = options

  if (nonInteractive) {
    logger.error(i18nText(
      '当前为非交互模式，检测到登录失效后直接失败。',
      'Non-interactive mode enabled, failing immediately on login expiration.',
    ))
    return 'cancel' as const
  }

  const shouldAllowRetry = retryMode === 'always' || (retryMode === 'once' && retryCount < 1)
  if (!shouldAllowRetry) {
    await promptWechatIdeLoginRetry({
      allowRetry: false,
      error: errorLike,
      logger,
      promptOpenIdeLogin: true,
      retryTimeoutMs,
    })
    logger.info(i18nText('当前重试策略不允许继续重试。', 'Current retry policy does not allow further retries.'))
    return 'cancel' as const
  }

  const action = await promptWechatIdeLoginRetry({
    error: errorLike,
    logger,
    promptOpenIdeLogin: true,
    retryTimeoutMs,
  })
  return action
}

function flushExecutionOutput(result: unknown) {
  if (!result || typeof result !== 'object') {
    return
  }

  const candidate = result as { stdout?: unknown, stderr?: unknown }
  if (typeof candidate.stdout === 'string' && candidate.stdout) {
    process.stdout.write(candidate.stdout)
  }
  if (typeof candidate.stderr === 'string' && candidate.stderr) {
    process.stderr.write(candidate.stderr)
  }
}

function captureWechatDevtoolsServicePort(result: unknown) {
  if (!result || typeof result !== 'object') {
    return
  }

  const candidate = result as { stderr?: unknown, stdout?: unknown }
  const output = [
    typeof candidate.stdout === 'string' ? candidate.stdout : '',
    typeof candidate.stderr === 'string' ? candidate.stderr : '',
  ].join('\n')
  const match = output.match(IDE_SERVER_STARTED_RE)
  if (!match?.[1]) {
    return
  }

  const port = Number.parseInt(match[1], 10)
  setRuntimeWechatDevtoolsServicePort(port)
}

/**
 * @description 运行微信开发者工具 CLI，并在登录失效时允许按键重试。
 */
export async function runWechatCliWithRetry(cliPath: string, argv: string[]) {
  const loginRetryOptions = resolveLoginRetryConfig(argv)
  const result = await runWithSuspendedSharedInput(async () => {
    return await runRetryableCommand<WechatCliExecutionResult, 'retry' | 'cancel' | 'timeout'>({
      createCancelError: result => createWechatIdeLoginRequiredExitError(unwrapWechatCliExecutionError(result)),
      execute: async () => {
        try {
          return {
            kind: 'result',
            value: await execute(cliPath, loginRetryOptions.runtimeArgv, {
              pipeStdout: false,
              pipeStderr: false,
            }),
          } as const
        }
        catch (error) {
          if (!isWechatIdeLoginRequiredError(error)) {
            throw error
          }
          return {
            error,
            kind: 'retryable',
          } as const
        }
      },
      isRetryableResult: result => result.kind === 'retryable' || isWechatIdeLoginRequiredError(result.value),
      onRetry: () => {
        logger.info(i18nText('正在重试连接微信开发者工具...', 'Retrying to connect Wechat DevTools...'))
      },
      promptRetry: async (result, retryCount) => {
        return await promptLoginRetry(unwrapWechatCliExecutionError(result), loginRetryOptions, retryCount)
      },
      shouldRetry: action => action === 'retry',
    })
  })

  if (result.kind === 'retryable') {
    throw createWechatIdeLoginRequiredExitError(result.error)
  }

  if (isWechatIdeLoginRequiredError(result.value)) {
    throw createWechatIdeLoginRequiredExitError(result.value)
  }

  captureWechatDevtoolsServicePort(result.value)
  flushExecutionOutput(result.value)
}
