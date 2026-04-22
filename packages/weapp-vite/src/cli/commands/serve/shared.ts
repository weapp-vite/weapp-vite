import type { GlobalCLIOptions } from '../../types'
import process from 'node:process'

export interface ServeMiniProgramDevActions {
  openIde: () => Promise<string>
  projectPath?: string
  rebuild: () => Promise<string>
}

export interface CreateServeMiniProgramDevActionsOptions {
  build: () => Promise<unknown>
  fallbackProjectPath?: string
  openIde: (projectPath?: string) => Promise<void>
  projectPath?: string
  tryReuseForwardConsole?: () => Promise<boolean>
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
    openIde: async () => {
      const openedByForwardConsole = await options.tryReuseForwardConsole?.()
      if (openedByForwardConsole) {
        return '已通过控制台转发复用当前开发者工具会话'
      }

      await options.openIde(projectPath)
      return '已重新打开微信开发者工具项目'
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
