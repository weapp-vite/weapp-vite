import type { TerminalRuntimeFailure } from './terminalRuntimeFailure'
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveManagedJournalScope } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/scope'
import { classifyTerminalRuntimeFailure, parseTerminalRuntimeFailureLine, TERMINAL_RUNTIME_FAILURE_MARKER } from './terminalRuntimeFailure'

interface StoredTerminalFailure extends TerminalRuntimeFailure {
  schemaVersion: 1
  scopeId: string
}

export interface TerminalRuntimeLaunchGuard {
  blockedError: () => Promise<Error | undefined>
  record: (error: unknown) => Promise<void>
}

const firstErrors = new Map<string, Error>()
const unpersistedErrors = new Map<string, Error>()
const evidenceName = '.runtime-terminal'

function blockedError(cause: Error) {
  const error = new Error('This managed DevTools invocation is frozen after a terminal runtime failure; recover it before starting a new invocation.', { cause })
  error.name = 'ManagedRuntimeLaunchBlockedError'
  return error
}

function storedFailure(value: unknown, scopeId: string): StoredTerminalFailure {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 4) {
    throw new Error('Managed runtime terminal evidence is malformed; refusing another launch.')
  }
  const record = value as Record<string, unknown>
  const failure = parseTerminalRuntimeFailureLine(`${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code: record.code, reason: record.reason })}`)
  const canonical = failure && classifyTerminalRuntimeFailure(Object.assign(new Error(failure.reason), { code: failure.code }))
  if (record.schemaVersion !== 1 || record.scopeId !== scopeId || !failure || canonical?.reason !== failure.reason) {
    throw new Error('Managed runtime terminal evidence does not match its ownership scope; refusing another launch.')
  }
  return { schemaVersion: 1, scopeId, ...failure }
}

/** 终态证据只属于已登记的任务根；无受管日志的 mock 不共享失败状态。 */
export async function createTerminalRuntimeLaunchGuard(journalPath?: string): Promise<TerminalRuntimeLaunchGuard> {
  if (!journalPath?.trim()) {
    return { blockedError: async () => undefined, record: async () => {} }
  }
  const journal = path.resolve(journalPath.trim())
  const identity = await resolveManagedJournalScope(journal)
  if (!identity.scopeId) {
    throw new Error('Managed runtime launch requires an explicitly registered journal ownership scope.')
  }
  const scopeId = identity.scopeId
  const key = `${identity.rootPath}\0${scopeId}`
  // journal 只将 *.json 视为窗口记录；独立旁证不参与窗口扫描或递归清理。
  const file = path.join(identity.rootPath, evidenceName)

  async function assertScope() {
    const current = await resolveManagedJournalScope(journal)
    if (current.rootPath !== identity.rootPath || current.scopeId !== scopeId) {
      throw new Error('Managed runtime launch journal identity changed; refusing another launch.')
    }
  }

  async function readFailure() {
    const stat = await fs.lstat(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') {
        throw error
      }
    })
    if (!stat) {
      return undefined
    }
    if (!stat.isFile()) {
      throw new Error('Managed runtime terminal evidence must be a regular file; refusing another launch.')
    }
    return storedFailure(JSON.parse(await fs.readFile(file, 'utf8')) as unknown, scopeId)
  }

  return {
    async blockedError() {
      await assertScope()
      const failure = await readFailure()
      const original = firstErrors.get(key)
      const unpersisted = unpersistedErrors.get(key)
      if (!failure && !original && !unpersisted) {
        return undefined
      }
      // 写入碰撞期间的本地错误不能替代真正首写者；完整磁盘证据优先于未持久化状态。
      return blockedError(original ?? (failure ? Object.assign(new Error(failure.reason), { code: failure.code }) : unpersisted!))
    },
    async record(error) {
      const failure = classifyTerminalRuntimeFailure(error)
      if (!failure || !(error instanceof Error)) {
        return
      }
      try {
        await assertScope()
        const record: StoredTerminalFailure = { schemaVersion: 1, scopeId, ...failure }
        try {
          // wx 保留首个写入者；读取撞到尚未完成的写入也必须拒绝启动。
          await fs.writeFile(file, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 })
          firstErrors.set(key, error)
        }
        catch (writeError) {
          if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw writeError
          }
          if (!await readFailure()) {
            throw new Error('Managed runtime terminal evidence disappeared during a write collision; refusing another launch.')
          }
        }
      }
      catch (stateError) {
        unpersistedErrors.set(key, unpersistedErrors.get(key) ?? error)
        throw new AggregateError([error, stateError], 'Terminal runtime failure could not be safely recorded; refusing another launch.', { cause: error })
      }
    },
  }
}
