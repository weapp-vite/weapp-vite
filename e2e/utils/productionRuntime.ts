import type { RuntimeProviderName } from './runtimeProvider'
import path from 'node:path'
import process from 'node:process'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'

interface RuntimeSession {
  close: () => Promise<unknown>
}

interface ProductionRuntimeOptions<T extends RuntimeSession> {
  projectPath: string
  provider: RuntimeProviderName
  cliPath?: string
  launch: (options: { projectPath: string, cliPath?: string }) => Promise<T>
}

/** 全量生产代际独占自己的项目与连接；不用于 HMR，也不退出共享 IDE 宿主。 */
export function createProductionRuntime<T extends RuntimeSession>(options: ProductionRuntimeOptions<T>) {
  const projectPath = path.resolve(options.projectPath)
  const cliPath = options.provider === 'devtools'
    ? options.cliPath?.trim() || process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim()
    : undefined
  if (options.provider === 'devtools' && !cliPath) {
    throw new Error('Production runtime requires an explicitly selected WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH')
  }
  let owned: { session: T, releasePending: boolean } | undefined
  let launchFailed = false
  let opening: Promise<T> | undefined
  let closing: Promise<void> | undefined

  async function close() {
    if (closing) {
      return closing
    }
    const pendingOpen = opening
    closing = (async () => {
      await pendingOpen
      if (!owned) {
        return
      }
      // 启动成功不授予窗口所有权；受管会话负责验证、关窗、断连及失败后的幂等重试。
      owned.releasePending = true
      await owned.session.close()
      owned = undefined
    })()
    try {
      await closing
    }
    finally {
      closing = undefined
    }
  }

  function open() {
    const pendingClose = closing
    opening ??= (async () => {
      await pendingClose
      if (launchFailed) {
        throw new Error('Previous production launch failed; its managed project journal must be recovered before retrying')
      }
      if (owned) {
        if (owned.releasePending) {
          throw new Error('Previous production project has not closed; refusing to load another generation')
        }
        return owned.session
      }
      // describe 阶段只声明代际；direct Vitest 的 setup 会在 beforeAll 中登记 journal。
      if (options.provider === 'devtools' && !process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim()) {
        throw new Error(`Production runtime requires a managed project journal: ${MANAGED_PROJECT_JOURNAL_ENV}`)
      }
      try {
        const session = await options.launch({ projectPath, cliPath })
        owned = { session, releasePending: false }
        return session
      }
      catch (error) {
        launchFailed = options.provider === 'devtools'
        throw error
      }
    })()
    const current = opening
    return current.finally(() => {
      if (opening === current) {
        opening = undefined
      }
    })
  }

  return { open, close }
}
