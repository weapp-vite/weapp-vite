import type {
  AutomatorMiniProgram,
  DevtoolsRuntimeHooks,
  DevtoolsRuntimeSessionOptions,
} from './mcp'

export * from './lease'
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
  closeWhenUnused?: boolean
  session: Promise<AutomatorMiniProgram>
}

const sharedMiniProgramSessions = new Map<string, SharedMiniProgramSessionEntry>()

function normalizeError(hooks: DevtoolsRuntimeHooks, error: unknown) {
  const normalized = hooks.normalizeConnectionError?.(error) ?? error
  return normalized instanceof Error ? normalized : new Error(String(normalized))
}

export function resolveSharedMiniProgramSessionKey(options: Pick<DevtoolsRuntimeSessionOptions, 'port' | 'projectPath' | 'sessionId'>) {
  const sessionSuffix = options.sessionId || (options.port ? `port:${options.port}` : 'default')
  return `${options.projectPath}#${sessionSuffix}`
}

/**
 * @description 获取指定项目的共享 automator 会话；若不存在则自动创建。
 */
export async function acquireSharedMiniProgram(
  hooks: DevtoolsRuntimeHooks,
  options: DevtoolsRuntimeSessionOptions,
): Promise<AutomatorMiniProgram> {
  const sessionKey = resolveSharedMiniProgramSessionKey(options)
  const existing = sharedMiniProgramSessions.get(sessionKey)
  if (existing) {
    existing.refs += 1
    return await existing.session
  }

  const session = hooks.connectMiniProgram(options)
  const entry: SharedMiniProgramSessionEntry = {
    refs: 1,
    session,
  }
  sharedMiniProgramSessions.set(sessionKey, entry)

  try {
    return await session
  }
  catch (error) {
    sharedMiniProgramSessions.delete(sessionKey)
    throw normalizeError(hooks, error)
  }
}

/** Release a subscription using the exact key returned by resolveSharedMiniProgramSessionKey. */
export function releaseSharedMiniProgramByKey(sessionKey: string) {
  const entry = sharedMiniProgramSessions.get(sessionKey)
  if (entry) {
    entry.refs = Math.max(0, entry.refs - 1)
    if (entry.refs === 0 && entry.closeWhenUnused) {
      sharedMiniProgramSessions.delete(sessionKey)
      void entry.session.then(program => program.disconnect()).catch(() => undefined)
    }
  }
}

/**
 * @description 释放指定项目的共享会话引用；会话对象会继续缓存，直到显式关闭或重置。
 */
export function releaseSharedMiniProgram(projectPath: string, sessionIdOrPort?: string | number) {
  releaseSharedMiniProgramByKey(resolveSharedMiniProgramSessionKey({
    projectPath,
    ...(typeof sessionIdOrPort === 'number' ? { port: sessionIdOrPort } : {}),
    ...(typeof sessionIdOrPort === 'string' ? { sessionId: sessionIdOrPort } : {}),
  }))
}

/**
 * @description 关闭并移除指定项目的共享 automator 会话。
 */
export async function closeSharedMiniProgram(projectPath: string, sessionIdOrPort?: string | number) {
  const sessionKey = resolveSharedMiniProgramSessionKey({
    projectPath,
    ...(typeof sessionIdOrPort === 'number' ? { port: sessionIdOrPort } : {}),
    ...(typeof sessionIdOrPort === 'string' ? { sessionId: sessionIdOrPort } : {}),
  })
  const entry = sharedMiniProgramSessions.get(sessionKey)
  if (!entry) {
    return
  }
  sharedMiniProgramSessions.delete(sessionKey)
  const miniProgram = await entry.session.catch(() => null)
  miniProgram?.disconnect()
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

  if (options.sharedSession) {
    const miniProgram = await acquireSharedMiniProgram(hooks, options)

    try {
      return await runner(miniProgram)
    }
    catch (error) {
      await closeSharedMiniProgram(options.projectPath, options.sessionId || options.port)
      throw normalizeError(hooks, error)
    }
    finally {
      releaseSharedMiniProgram(options.projectPath, options.sessionId || options.port)
    }
  }

  let miniProgram: AutomatorMiniProgram | null = null

  try {
    miniProgram = await hooks.connectMiniProgram(options)
    return await runner(miniProgram)
  }
  catch (error) {
    throw normalizeError(hooks, error)
  }
  finally {
    if (miniProgram) {
      miniProgram.disconnect()
    }
  }
}

export type {
  AutomatorElement,
  AutomatorMiniProgram,
  AutomatorPage,
  DevtoolsConnectionInput,
  DevtoolsContext,
  DevtoolsElementSnapshot,
  DevtoolsPageSnapshot,
  DevtoolsRuntimeHooks,
  DevtoolsRuntimeSessionOptions,
  DevtoolsToolResult,
  MiniProgramElementLike,
} from './mcp'

/** 检查缓存，供调用方记录其实际创建的连接。 */
export function hasSharedMiniProgram(options: Pick<DevtoolsRuntimeSessionOptions, 'projectPath' | 'port' | 'sessionId'>) {
  return sharedMiniProgramSessions.has(resolveSharedMiniProgramSessionKey(options))
}

/** 只清理仍由调用方创建、且已无活动引用的连接。 */
export async function closeOwnedSharedMiniProgram(options: Pick<DevtoolsRuntimeSessionOptions, 'projectPath' | 'port' | 'sessionId'>, owned: unknown) {
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
  sharedMiniProgramSessions.delete(key)
  program?.disconnect()
}

/** Retain a manager subscription independently of an in-flight operation. */
export function retainSharedMiniProgram(sessionKey: string) {
  const entry = sharedMiniProgramSessions.get(sessionKey)
  if (entry) {
    entry.refs += 1
  }
}
