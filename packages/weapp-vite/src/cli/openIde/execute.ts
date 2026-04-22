import {
  isWechatIdeLoginRequiredError,
  parse,
  promptWechatIdeLoginRetry,
  runRetryableCommand,
} from 'weapp-ide-cli'
import logger from '../../logger'

export interface ExecuteWechatIdeCliCommandOptions {
  cancelLevel?: 'info' | 'warn'
  onNonLoginError?: (error: unknown) => void
  onRetry?: () => void
}

/**
 * @description 统一执行 weapp-ide-cli 命令，并在登录失效时复用同一套重试交互。
 */
export async function executeWechatIdeCliCommand(
  argv: string[],
  options: ExecuteWechatIdeCliCommandOptions = {},
) {
  const {
    cancelLevel = 'warn',
    onNonLoginError,
    onRetry,
  } = options

  await runRetryableCommand<null | unknown, 'retry' | 'cancel' | 'timeout'>({
    createCancelError: () => new Error('cancelled'),
    execute: async () => {
      try {
        await parse(argv)
        return null
      }
      catch (error) {
        if (!isWechatIdeLoginRequiredError(error)) {
          if (onNonLoginError) {
            onNonLoginError(error)
            return null
          }
          throw error
        }
        return error
      }
    },
    isRetryableResult: result => result !== null,
    onCancel: () => {},
    onRetry: () => {
      onRetry?.()
    },
    promptRetry: async error => await promptWechatIdeLoginRetry({
      cancelLevel,
      error,
      logger,
    }),
    shouldRetry: action => action === 'retry',
  })
}
