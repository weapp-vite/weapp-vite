import type { Element, MiniProgram, Page } from '@weapp-vite/miniprogram-automator'

export interface MiniProgramEventMap {
  console: (payload: unknown) => void
  exception: (payload: unknown) => void
}

export type AutomatorMiniProgram = InstanceType<typeof MiniProgram>
export type AutomatorPage = InstanceType<typeof Page>
export type AutomatorElement = InstanceType<typeof Element> & {
  input?: (value: string) => Promise<void>
}

export interface DevtoolsRuntimeSessionOptions {
  miniProgram?: AutomatorMiniProgram
  preferOpenedSession?: boolean
  projectPath: string
  sharedSession?: boolean
  timeout?: number
}

export interface DevtoolsRuntimeHooks {
  connectMiniProgram: (options: DevtoolsRuntimeSessionOptions) => Promise<AutomatorMiniProgram>
  normalizeConnectionError?: (error: unknown) => unknown
}

interface SharedMiniProgramSessionEntry {
  refs: number
  session: Promise<AutomatorMiniProgram>
}

const sharedMiniProgramSessions = new Map<string, SharedMiniProgramSessionEntry>()

function normalizeError(hooks: DevtoolsRuntimeHooks, error: unknown) {
  const normalized = hooks.normalizeConnectionError?.(error) ?? error
  return normalized instanceof Error ? normalized : new Error(String(normalized))
}

/**
 * @description 获取指定项目的共享 automator 会话；若不存在则自动创建。
 */
export async function acquireSharedMiniProgram(
  hooks: DevtoolsRuntimeHooks,
  options: DevtoolsRuntimeSessionOptions,
): Promise<AutomatorMiniProgram> {
  const existing = sharedMiniProgramSessions.get(options.projectPath)
  if (existing) {
    existing.refs += 1
    return await existing.session
  }

  const session = hooks.connectMiniProgram(options)
  const entry: SharedMiniProgramSessionEntry = {
    refs: 1,
    session,
  }
  sharedMiniProgramSessions.set(options.projectPath, entry)

  try {
    return await session
  }
  catch (error) {
    sharedMiniProgramSessions.delete(options.projectPath)
    throw normalizeError(hooks, error)
  }
}

/**
 * @description 释放指定项目的共享会话引用；会话对象会继续缓存，直到显式关闭或重置。
 */
export function releaseSharedMiniProgram(projectPath: string) {
  const entry = sharedMiniProgramSessions.get(projectPath)
  if (!entry) {
    return
  }
  entry.refs = Math.max(0, entry.refs - 1)
}

/**
 * @description 关闭并移除指定项目的共享 automator 会话。
 */
export async function closeSharedMiniProgram(projectPath: string) {
  const entry = sharedMiniProgramSessions.get(projectPath)
  if (!entry) {
    return
  }
  sharedMiniProgramSessions.delete(projectPath)
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
      await closeSharedMiniProgram(options.projectPath)
      throw normalizeError(hooks, error)
    }
    finally {
      releaseSharedMiniProgram(options.projectPath)
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
      await miniProgram.close()
    }
  }
}
