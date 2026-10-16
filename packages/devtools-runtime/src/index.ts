import type {
  AutomatorMiniProgram,
  DevtoolsRuntimeHooks,
  DevtoolsRuntimeSessionOptions,
} from './mcp'

export * from './lease'
export { mutateLease } from './lease/directory'
export * from './lease/machine'
export * from './lease/machineRecovery'
export {
  readDevtoolsElementSnapshot,
  resolveDevtoolsProjectPath,
  resolveDevtoolsWorkspacePath,
  toDevtoolsSerializableValue,
} from './mcp'

export interface MiniProgramEventMap {
  console: (payload: unknown) => void
  exception: (payload: unknown) => void
}

interface SharedMiniProgramSessionEntry {
  refs: number
  options: SharedMiniProgramSessionOptions
  closeWhenUnused?: boolean
  session: Promise<AutomatorMiniProgram>
  closeRequested?: boolean
  closing?: Promise<void>
}

const sharedMiniProgramSessions = new Map<string, SharedMiniProgramSessionEntry>()

function normalizeError(hooks: DevtoolsRuntimeHooks, error: unknown) {
  const normalized = hooks.normalizeConnectionError?.(error) ?? error
  return normalized instanceof Error ? normalized : new Error(String(normalized))
}

export type SharedMiniProgramSessionOptions = Pick<DevtoolsRuntimeSessionOptions, 'port' | 'projectPath' | 'sessionId' | 'cliPath' | 'installationId' | 'runtimeProvider'>

export function resolveSharedMiniProgramSessionKey(options: SharedMiniProgramSessionOptions) {
  const installation = options.installationId || options.cliPath || options.runtimeProvider || 'unresolved'
  return JSON.stringify([installation, options.projectPath, options.sessionId || null, options.port || null])
}

function resolveExistingSessionKey(options: SharedMiniProgramSessionOptions) {
  // 旧清理入口只能处理唯一的已持有连接，不能在多个安装或命名会话端口间猜测归属。
  const matching = [...sharedMiniProgramSessions].filter(([, entry]) => {
    const current = entry.options
    const sessionMatches = options.sessionId
      ? current.sessionId === options.sessionId && (!options.port || current.port === options.port)
      : !current.sessionId && current.port === options.port
    return (!options.installationId || current.installationId === options.installationId)
      && (!options.cliPath || current.cliPath === options.cliPath)
      && (!options.runtimeProvider || current.runtimeProvider === options.runtimeProvider)
      && current.projectPath === options.projectPath
      && sessionMatches
  })
  return matching.length === 1 ? matching[0]![0] : undefined
}

/** 确认连接关闭后移除缓存；关闭失败的条目只允许重试清理。 */
function closeSharedEntry(sessionKey: string, entry: SharedMiniProgramSessionEntry): Promise<void> {
  entry.closeRequested = true
  entry.closing ??= (async () => {
    const program = await entry.session
    await program.disconnect()
    if (sharedMiniProgramSessions.get(sessionKey) === entry) {
      sharedMiniProgramSessions.delete(sessionKey)
    }
  })().catch((error: unknown) => {
    entry.closing = undefined
    throw error
  })
  return entry.closing
}

/**
 * @description 获取指定项目的共享 automator 会话；若不存在则自动创建。
 */
export async function acquireSharedMiniProgram(
  hooks: DevtoolsRuntimeHooks,
  options: DevtoolsRuntimeSessionOptions,
): Promise<AutomatorMiniProgram> {
  options = await hooks.resolveSessionOptions?.(options) ?? options
  const sessionKey = resolveSharedMiniProgramSessionKey(options)
  const existing = sharedMiniProgramSessions.get(sessionKey)
  if (existing) {
    if (existing.closeRequested) {
      await closeSharedEntry(sessionKey, existing)
      return await acquireSharedMiniProgram(hooks, options)
    }
    existing.refs += 1
    return await existing.session
  }

  const session = hooks.connectMiniProgram(options)
  const entry: SharedMiniProgramSessionEntry = {
    refs: 1,
    options,
    session,
  }
  sharedMiniProgramSessions.set(sessionKey, entry)

  try {
    return await session
  }
  catch (error) {
    if (sharedMiniProgramSessions.get(sessionKey) === entry) {
      sharedMiniProgramSessions.delete(sessionKey)
    }
    throw normalizeError(hooks, error)
  }
}

/** 使用创建连接时的精确键释放订阅。 */
export function releaseSharedMiniProgramByKey(sessionKey: string): Promise<void> {
  const entry = sharedMiniProgramSessions.get(sessionKey)
  if (entry) {
    entry.refs = Math.max(0, entry.refs - 1)
    if (entry.refs === 0 && entry.closeWhenUnused) {
      return closeSharedEntry(sessionKey, entry)
    }
  }
  return Promise.resolve()
}

/**
 * @description 释放指定项目的共享会话引用；会话对象会继续缓存，直到显式关闭或重置。
 */
export function releaseSharedMiniProgram(projectPath: string, sessionIdOrPort?: string | number, installation: Omit<SharedMiniProgramSessionOptions, 'projectPath'> = {}): Promise<void> {
  const key = resolveExistingSessionKey({
    ...installation,
    projectPath,
    ...(typeof sessionIdOrPort === 'number' ? { port: sessionIdOrPort } : {}),
    ...(typeof sessionIdOrPort === 'string' ? { sessionId: sessionIdOrPort } : {}),
  })
  if (key) {
    return releaseSharedMiniProgramByKey(key)
  }
  return Promise.resolve()
}

/**
 * @description 关闭并移除指定项目的共享 automator 会话。
 */
export async function closeSharedMiniProgram(projectPath: string, sessionIdOrPort?: string | number, installation: Omit<SharedMiniProgramSessionOptions, 'projectPath'> = {}) {
  const sessionKey = resolveExistingSessionKey({
    ...installation,
    projectPath,
    ...(typeof sessionIdOrPort === 'number' ? { port: sessionIdOrPort } : {}),
    ...(typeof sessionIdOrPort === 'string' ? { sessionId: sessionIdOrPort } : {}),
  })
  const entry = sessionKey ? sharedMiniProgramSessions.get(sessionKey) : undefined
  if (!entry || !sessionKey) {
    return
  }
  await closeSharedEntry(sessionKey, entry)
}

/**
 * @description 获取当前共享会话数量，供测试断言使用。
 */
export function getSharedMiniProgramSessionCount() {
  return sharedMiniProgramSessions.size
}

/**
 * @description 统一管理 automator 会话生命周期。
 */
export async function withMiniProgram<T>(
  hooks: DevtoolsRuntimeHooks,
  options: DevtoolsRuntimeSessionOptions,
  runner: (miniProgram: AutomatorMiniProgram) => Promise<T>,
): Promise<T> {
  if (options.miniProgram) {
    return await runner(options.miniProgram)
  }

  options = await hooks.resolveSessionOptions?.(options) ?? options

  if (options.sharedSession) {
    const miniProgram = await acquireSharedMiniProgram(hooks, options)
    let result!: T
    let failure: Error | undefined
    try {
      result = await runner(miniProgram)
    }
    catch (error) {
      failure = normalizeError(hooks, error)
    }
    const cleanupErrors: unknown[] = []
    if (failure) {
      try {
        await closeSharedMiniProgram(options.projectPath, options.sessionId || options.port, options)
      }
      catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    try {
      await releaseSharedMiniProgram(options.projectPath, options.sessionId || options.port, options)
    }
    catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    }
    if (cleanupErrors.length) {
      throw new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], 'MiniProgram operation and shared connection cleanup failed', { cause: failure })
    }
    if (failure) {
      throw failure
    }
    return result
  }

  let miniProgram: AutomatorMiniProgram | null = null
  let result!: T
  let failure: Error | undefined

  try {
    miniProgram = await hooks.connectMiniProgram(options)
    result = await runner(miniProgram)
  }
  catch (error) {
    failure = normalizeError(hooks, error)
  }
  if (miniProgram) {
    try {
      await miniProgram.disconnect()
    }
    catch (cleanupError) {
      if (failure) {
        throw new AggregateError([failure, cleanupError], 'MiniProgram operation and connection cleanup failed', { cause: failure })
      }
      throw cleanupError
    }
  }
  if (failure) {
    throw failure
  }
  return result
}

export type {
  AutomatorElement,
  AutomatorMiniProgram,
  AutomatorPage,
  DevtoolsConnectionInput,
  DevtoolsContext,
  DevtoolsElementSnapshot,
  DevtoolsInstallationContext,
  DevtoolsPageSnapshot,
  DevtoolsRuntimeHooks,
  DevtoolsRuntimeSessionOptions,
  DevtoolsToolResult,
  MiniProgramElementLike,
} from './mcp'

/** 检查缓存，供调用方记录其实际创建的连接。 */
export function hasSharedMiniProgram(options: SharedMiniProgramSessionOptions) {
  return sharedMiniProgramSessions.has(resolveSharedMiniProgramSessionKey(options))
}

/** 只清理仍由调用方创建、且已无活动引用的连接。 */
export async function closeOwnedSharedMiniProgram(options: SharedMiniProgramSessionOptions, owned: unknown) {
  const key = resolveSharedMiniProgramSessionKey(options)
  const entry = sharedMiniProgramSessions.get(key)
  if (!entry) {
    return
  }
  const program = await entry.session.catch(() => null)
  if (program !== owned || sharedMiniProgramSessions.get(key) !== entry) {
    return
  }
  if (entry.refs !== 0) {
    entry.closeWhenUnused = true
    return
  }
  await closeSharedEntry(key, entry)
}

/** 单独保留管理器订阅，避免与正在执行的操作共享引用计数。 */
export function retainSharedMiniProgram(sessionKey: string) {
  const entry = sharedMiniProgramSessions.get(sessionKey)
  if (entry) {
    entry.refs += 1
  }
}
