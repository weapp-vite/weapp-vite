import type { GlobalCLIOptions } from '../../types'
import process from 'node:process'

export interface ServeMiniProgramDevActions {
  openIde: (options?: OpenServeIdeOptions) => Promise<string>
  projectPath?: string
  rebuild: () => Promise<string>
}

export interface OpenServeIdeOptions {
  forceOpen?: boolean
  forceReopen?: boolean
}

export interface CreateServeMiniProgramDevActionsOptions {
  build: () => Promise<unknown>
  fallbackProjectPath?: string
  openIde: (projectPath?: string, options?: OpenServeIdeOptions) => Promise<void>
  projectPath?: string
  tryReuseForwardConsole?: () => Promise<boolean>
}

function startBackgroundForwardConsoleReuse(
  tryReuseForwardConsole?: () => Promise<boolean>,
) {
  if (!tryReuseForwardConsole) {
    return
  }

  try {
    void tryReuseForwardConsole().catch(() => {})
  }
  catch {
    // 日志桥只用于增强调试体验，不能阻塞 IDE 打开与 HMR。
  }
}

export function resolveWebHost(host: GlobalCLIOptions['host']) {
  if (host === undefined) {
    return undefined
  }
  if (typeof host === 'boolean') {
    return host
  }
  if (typeof host === 'string') {
    return host
  }
  return String(host)
}

/**
 * @description 为 serve 模式构造统一的小程序开发动作，供热键与命令复用。
 */
export function createServeMiniProgramDevActions(
  options: CreateServeMiniProgramDevActionsOptions,
): ServeMiniProgramDevActions {
  const projectPath = options.projectPath ?? options.fallbackProjectPath
  return {
    projectPath,
    openIde: async (openOptions = {}) => {
      if (!openOptions.forceOpen && await options.tryReuseForwardConsole?.()) {
        return '已通过控制台转发复用当前开发者工具会话'
      }

      await options.openIde(projectPath, openOptions)
      startBackgroundForwardConsoleReuse(options.tryReuseForwardConsole)
      return openOptions.forceReopen
        ? '已重新打开微信开发者工具项目'
        : '已打开或复用微信开发者工具项目'
    },
    rebuild: async () => {
      await options.build()
      return '已手动重新构建当前小程序产物'
    },
  }
}

export function waitForServeShutdownSignal() {
  return new Promise<void>((resolve) => {
    const onSignal = () => {
      process.off('SIGINT', onSignal)
      process.off('SIGTERM', onSignal)
      resolve()
    }

    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)
  })
}
