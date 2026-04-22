import { isWechatIdeLoginRequiredError, parse, promptWechatIdeLoginRetry } from 'weapp-ide-cli'
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

  while (true) {
    try {
      await parse(argv)
      return
    }
    catch (error) {
      if (!isWechatIdeLoginRequiredError(error)) {
        if (onNonLoginError) {
          onNonLoginError(error)
          return
        }
        throw error
      }

      const action = await promptWechatIdeLoginRetry({
        cancelLevel,
        error,
        logger,
      })

      if (action !== 'retry') {
        return
      }

      onRetry?.()
    }
  }
}
