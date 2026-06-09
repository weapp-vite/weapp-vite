import {
  clearWechatIdeCache,
  clearWechatIdeCacheByAutomator,
  closeWechatIdeProject,
  compileWechatIdeByAutomator,
  createWechatIdeLoginRequiredExitError,
  isWechatIdeEngineBuildEndpointMissingError,
  isWechatIdeLoginRequiredError,
  isWechatIdeLoginRequiredExitError,
  openWechatIdeProjectByHttp,
  parse,
  promptWechatIdeLoginRetry,
  quitWechatIde,
  resetWechatIdeFileUtilsByHttp,
  runRetryableCommand,
  runWechatIdeEngineBuild,
  runWithSuspendedSharedInput,
} from 'weapp-ide-cli'
import logger from '../../logger'

export interface ExecuteWechatIdeCliCommandOptions {
  automatorMode?: 'prefer' | 'require' | 'skip'
  cancelLevel?: 'info' | 'warn'
  engineBuildFallbackToCli?: boolean
  httpMode?: 'prefer' | 'require' | 'skip'
  promptOpenIdeLogin?: boolean
  onNonLoginError?: (error: unknown) => void
  onRetry?: () => void
  projectPath?: string
  preserveProjectRoot?: boolean
}

function readArgOption(argv: readonly string[], ...names: string[]) {
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!names.includes(current)) {
      continue
    }
    const next = argv[index + 1]
    if (typeof next === 'string' && !next.startsWith('-')) {
      return next
    }
  }
}

async function tryExecuteWechatIdeCliCommandByAutomator(
  argv: readonly string[],
  projectPath?: string,
  options: Pick<ExecuteWechatIdeCliCommandOptions, 'preserveProjectRoot'> = {},
) {
  if (!projectPath) {
    return false
  }

  const command = argv[0]
  if (!command) {
    return false
  }

  if (command === 'compile') {
    await compileWechatIdeByAutomator({
      preserveProjectRoot: options.preserveProjectRoot,
      projectPath,
    })
    return true
  }

  if (command === 'cache') {
    const cleanType = readArgOption(argv, '--clean', '-c')
    if (cleanType !== 'compile' && cleanType !== 'all') {
      return false
    }

    await clearWechatIdeCacheByAutomator({
      clean: cleanType,
      preserveProjectRoot: options.preserveProjectRoot,
      projectPath,
    })
    return true
  }

  return false
}

async function tryExecuteWechatIdeCliCommandByHttp(
  argv: readonly string[],
  projectPath?: string,
  engineBuildFallbackToCli = false,
) {
  const command = argv[0]
  if (!command) {
    return false
  }

  if (command === 'compile') {
    if (!projectPath) {
      return false
    }

    await openWechatIdeProjectByHttp(projectPath)
    return true
  }

  if (command === 'reset-fileutils') {
    if (!projectPath) {
      return false
    }

    await resetWechatIdeFileUtilsByHttp(projectPath)
    return true
  }

  if (command === 'engine' && argv[1] === 'build') {
    const engineProjectPath = argv[2] || projectPath
    if (!engineProjectPath) {
      return false
    }

    await runWechatIdeEngineBuild(engineProjectPath, {
      fallbackToCli: engineBuildFallbackToCli,
      logPath: readArgOption(argv, '--logPath', '-l'),
    })
    return true
  }

  return false
}

async function tryExecuteWechatIdeCliCommandByHelper(argv: readonly string[]) {
  const command = argv[0]
  if (!command) {
    return false
  }

  if (command === 'close') {
    await closeWechatIdeProject()
    return true
  }

  if (command === 'quit') {
    await quitWechatIde()
    return true
  }

  if (command === 'cache') {
    const cleanType = readArgOption(argv, '--clean', '-c')
    if (!cleanType) {
      return false
    }

    await clearWechatIdeCache({
      clean: cleanType as 'all' | 'auth' | 'compile' | 'file' | 'network' | 'session' | 'storage',
    })
    return true
  }

  return false
}

/**
 * @description 统一执行 weapp-ide-cli 命令，并在登录失效时复用同一套重试交互。
 */
export async function executeWechatIdeCliCommand(
  argv: string[],
  options: ExecuteWechatIdeCliCommandOptions = {},
) {
  const {
    automatorMode = 'prefer',
    cancelLevel = 'warn',
    engineBuildFallbackToCli = false,
    httpMode = 'prefer',
    promptOpenIdeLogin = true,
    onNonLoginError,
    onRetry,
    projectPath,
    preserveProjectRoot,
  } = options

  await runWithSuspendedSharedInput(async () => {
    if (httpMode !== 'skip') {
      try {
        const handledByHttp = await tryExecuteWechatIdeCliCommandByHttp(argv, projectPath, engineBuildFallbackToCli)
        if (handledByHttp) {
          return
        }
      }
      catch (error) {
        if (httpMode === 'require' || isWechatIdeEngineBuildEndpointMissingError(error)) {
          throw error
        }
      }
    }

    if (automatorMode !== 'skip') {
      try {
        const handledByAutomator = await tryExecuteWechatIdeCliCommandByAutomator(argv, projectPath, {
          preserveProjectRoot,
        })
        if (handledByAutomator) {
          return
        }
      }
      catch (error) {
        if (automatorMode === 'require') {
          throw error
        }
        // automator 优先策略仅作增强；失败时回退到原有 CLI 命令链路
      }
    }

    try {
      const handledByHelper = await tryExecuteWechatIdeCliCommandByHelper(argv)
      if (handledByHelper) {
        return
      }
    }
    catch (error) {
      if (isWechatIdeLoginRequiredExitError(error)) {
        throw error
      }
      if (onNonLoginError) {
        onNonLoginError(error)
        return
      }
      throw error
    }

    await runRetryableCommand<null | unknown, 'retry' | 'cancel' | 'timeout'>({
      createCancelError: error => createWechatIdeLoginRequiredExitError(error, 'cancelled'),
      execute: async () => {
        try {
          await parse(argv)
          return null
        }
        catch (error) {
          if (isWechatIdeLoginRequiredExitError(error)) {
            throw error
          }
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
        promptOpenIdeLogin,
      }),
      shouldRetry: action => action === 'retry',
    })
  })
}

export { isWechatIdeLoginRequiredExitError }
