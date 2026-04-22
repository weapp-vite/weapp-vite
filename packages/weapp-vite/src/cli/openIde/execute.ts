import {
  clearWechatIdeCache,
  closeWechatIdeProject,
  isWechatIdeLoginRequiredError,
  openWechatIdeProjectByHttp,
  parse,
  promptWechatIdeLoginRetry,
  quitWechatIde,
  resetWechatIdeFileUtilsByHttp,
  runRetryableCommand,
  runWechatIdeEngineBuild,
  runWithSuspendedSharedInput,
  withMiniProgram,
} from 'weapp-ide-cli'
import logger from '../../logger'

export interface ExecuteWechatIdeCliCommandOptions {
  automatorMode?: 'prefer' | 'require'
  cancelLevel?: 'info' | 'warn'
  httpMode?: 'prefer' | 'require'
  onNonLoginError?: (error: unknown) => void
  onRetry?: () => void
  projectPath?: string
}

interface AutomatorToolLike {
  close?: () => Promise<unknown>
  tool?: (method: string, params?: Record<string, unknown>) => Promise<unknown>
}

const AUTOMATOR_TOOL_CANDIDATES = {
  cache: {
    all: [
      { method: 'clearCache', params: { clean: 'all' } },
      { method: 'cleanCache', params: { clean: 'all' } },
      { method: 'clearAllCache', params: {} },
    ],
    compile: [
      { method: 'clearCache', params: { clean: 'compile' } },
      { method: 'cleanCache', params: { clean: 'compile' } },
      { method: 'clearCompileCache', params: {} },
    ],
  },
  compile: [
    { method: 'compile', params: {} },
    { method: 'compileProject', params: {} },
    { method: 'recompile', params: {} },
  ],
} as const

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

async function runAutomatorToolCandidates(
  miniProgram: AutomatorToolLike,
  candidates: ReadonlyArray<{ method: string, params: Record<string, unknown> }>,
) {
  if (typeof miniProgram.tool !== 'function') {
    throw new TypeError('AUTOMATOR_TOOL_UNAVAILABLE')
  }

  let lastError: unknown
  for (const candidate of candidates) {
    try {
      await miniProgram.tool(candidate.method, candidate.params)
      return
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AUTOMATOR_TOOL_COMMAND_FAILED')
}

async function tryExecuteWechatIdeCliCommandByAutomator(argv: readonly string[], projectPath?: string) {
  if (!projectPath) {
    return false
  }

  const command = argv[0]
  if (!command) {
    return false
  }

  if (command === 'compile') {
    await withMiniProgram({
      preferOpenedSession: true,
      projectPath,
      sharedSession: true,
    }, async (miniProgram) => {
      await runAutomatorToolCandidates(miniProgram as AutomatorToolLike, AUTOMATOR_TOOL_CANDIDATES.compile)
    })
    return true
  }

  if (command === 'cache') {
    const cleanType = readArgOption(argv, '--clean', '-c')
    if (cleanType !== 'compile' && cleanType !== 'all') {
      return false
    }

    await withMiniProgram({
      preferOpenedSession: true,
      projectPath,
      sharedSession: true,
    }, async (miniProgram) => {
      await runAutomatorToolCandidates(
        miniProgram as AutomatorToolLike,
        AUTOMATOR_TOOL_CANDIDATES.cache[cleanType],
      )
    })
    return true
  }

  if (command === 'close' || command === 'quit') {
    await withMiniProgram({
      preferOpenedSession: true,
      projectPath,
      sharedSession: true,
    }, async (miniProgram) => {
      if (typeof (miniProgram as AutomatorToolLike).close !== 'function') {
        throw new TypeError('AUTOMATOR_CLOSE_UNAVAILABLE')
      }
      await miniProgram.close()
    })
    return true
  }

  return false
}

async function tryExecuteWechatIdeCliCommandByHttp(argv: readonly string[], projectPath?: string) {
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
    httpMode = 'prefer',
    onNonLoginError,
    onRetry,
    projectPath,
  } = options

  await runWithSuspendedSharedInput(async () => {
    try {
      const handledByHttp = await tryExecuteWechatIdeCliCommandByHttp(argv, projectPath)
      if (handledByHttp) {
        return
      }
    }
    catch (error) {
      if (httpMode === 'require') {
        throw error
      }
    }

    try {
      const handledByAutomator = await tryExecuteWechatIdeCliCommandByAutomator(argv, projectPath)
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

    try {
      const handledByHelper = await tryExecuteWechatIdeCliCommandByHelper(argv)
      if (handledByHelper) {
        return
      }
    }
    catch (error) {
      if (onNonLoginError) {
        onNonLoginError(error)
        return
      }
      throw error
    }

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
  })
}
