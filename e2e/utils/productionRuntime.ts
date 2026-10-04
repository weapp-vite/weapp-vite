import type { RuntimeProviderName } from './runtimeProvider'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'

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
  let owned: { session: T, protocolReleased: boolean, projectClosed: boolean } | undefined
  let opening: Promise<T> | undefined
  let closing: Promise<void> | undefined

  async function close() {
    if (closing) {
      return closing
    }
    closing = (async () => {
      await opening
      if (!owned) {
        return
      }
      const failures: unknown[] = []
      if (!owned.protocolReleased) {
        // 即使 Tool.close 不可用，也只释放一次拥有的连接，再按精确项目关闭 IDE 窗口。
        owned.protocolReleased = true
        try {
          await owned.session.close()
        }
        catch (error) {
          failures.push(error)
        }
      }
      if (!owned.projectClosed) {
        try {
          if (cliPath) {
            await execa(cliPath, ['close', '--project', projectPath], { timeout: 30_000, windowsHide: true })
          }
          owned.projectClosed = true
        }
        catch (error) {
          failures.push(error)
        }
      }
      if (owned.protocolReleased && owned.projectClosed) {
        owned = undefined
      }
      if (failures.length) {
        throw new AggregateError(failures, 'Production runtime resources did not close cleanly')
      }
    })()
    try {
      await closing
    }
    finally {
      closing = undefined
    }
  }

  function open() {
    opening ??= (async () => {
      await closing
      if (owned) {
        if (owned.protocolReleased) {
          throw new Error('Previous production project has not closed; refusing to load another generation')
        }
        return owned.session
      }
      const session = await options.launch({ projectPath, cliPath })
      owned = { session, protocolReleased: false, projectClosed: false }
      return session
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
