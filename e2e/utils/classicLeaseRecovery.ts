import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expect } from 'vitest'
import { startDevProcess } from './dev-process'
import { createDevProcessEnv } from './dev-process-env'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

export class ClassicLeaseCleanupError extends Error {
  readonly name = 'ClassicLeaseCleanupError'

  constructor(cause: unknown) {
    super('Classic lease CLI cleanup could not be confirmed; preserve the project and its journal.', { cause })
  }
}

function hasCleanupFailure(error: unknown): boolean {
  if (error instanceof ClassicLeaseCleanupError) {
    return true
  }
  if (error instanceof AggregateError && error.errors.some(hasCleanupFailure)) {
    return true
  }
  return error instanceof Error && error.cause !== error && error.cause !== undefined && hasCleanupFailure(error.cause)
}

/** 先独立收尾全部登记资源；未知清理失败保留项目，原错误与收尾错误同时保留。 */
export async function cleanupClassicLeaseProject(project: string | undefined, dispose: () => Promise<void>, primaryError?: unknown) {
  try {
    await dispose()
    if (project && !hasCleanupFailure(primaryError)) {
      await rm(project, { recursive: true, force: true })
    }
  }
  catch (cleanupError) {
    if (primaryError !== undefined) {
      throw new AggregateError([primaryError, cleanupError], 'Classic lease regression and cleanup both failed', { cause: primaryError })
    }
    throw cleanupError
  }
}

export function startClassicLeaseDev(project: string) {
  return startDevProcess(process.execPath, [CLI, 'dev', project, '--platform', 'weapp', '--skipNpm'], {
    cwd: ROOT,
    env: createDevProcessEnv(),
    all: true,
    ipc: true,
  })
}

/** 该错误只会在登记子进程退出、输出排空且资源清理完成后产生。 */
export async function stopFailedClassicLeaseDev(dev: ReturnType<typeof startClassicLeaseDev>) {
  try {
    await dev.stop()
  }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('Dev process failed during graceful shutdown:')) {
      return error
    }
    throw new ClassicLeaseCleanupError(error)
  }
}

export async function stopClassicLeaseDev(dev: ReturnType<typeof startClassicLeaseDev>) {
  try {
    await dev.stop()
  }
  catch (error) {
    throw new ClassicLeaseCleanupError(error)
  }
}

async function closeAfterClassicLeaseFailure(dev: ReturnType<typeof startClassicLeaseDev>, primaryError: unknown) {
  try {
    await stopClassicLeaseDev(dev)
  }
  catch (cleanupError) {
    throw new AggregateError([primaryError, cleanupError], 'Classic lease operation and cleanup both failed', { cause: primaryError })
  }
}

/** 用真实 CLI 的异常退出留下租约；正常关闭未完成的首错不能被恢复操作改写。 */
export async function leaveCrashedClassicLease(project: string) {
  const dev = startClassicLeaseDev(project)
  const journal = path.join(project, '.weapp-vite/ide-classic-project.private.config.json')
  let stopped = false
  let primaryError: unknown
  try {
    await dev.waitForInitialBuild()
    const saved = await readFile(journal, 'utf8')
    expect(JSON.parse(saved)).toHaveProperty('owner')
    expect(JSON.parse(saved)).toHaveProperty('pid', dev.pid)
    expect(JSON.parse(await readFile(path.join(project, 'project.private.config.json'), 'utf8'))).toHaveProperty('setting.compileHotReLoad', false)
    expect(dev.pid).toBeTypeOf('number')
    // PID 来源于本测试持有的直接 CLI 子进程，不按名称或命令行查找目标。
    process.kill(dev.pid!, 'SIGKILL')
    const failure = await stopFailedClassicLeaseDev(dev)
    stopped = true
    expect(failure).toBeInstanceOf(Error)
    await expect(dev.stop()).rejects.toBe(failure)
    expect(await readFile(journal, 'utf8')).toBe(saved)
    return JSON.parse(saved) as { owner: string }
  }
  catch (error) {
    primaryError = error
    throw error
  }
  finally {
    if (!stopped) {
      await closeAfterClassicLeaseFailure(dev, primaryError)
    }
  }
}

/** 活跃租约必须拒绝第二个开发命令，并通过实际 CLI 输出解释冲突。 */
export async function assertLiveClassicLeaseConflict(project: string) {
  const contender = startClassicLeaseDev(project)
  let stopped = false
  let primaryError: unknown
  try {
    const failure = await contender.waitForInitialBuild(60_000).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    const shutdown = await stopFailedClassicLeaseDev(contender)
    stopped = true
    expect(shutdown).toBeInstanceOf(Error)
    expect(contender.getOutput()).toMatch(/IDE classic/)
    expect(contender.getOutput()).toMatch(/持有/)
  }
  catch (error) {
    primaryError = error
    throw error
  }
  finally {
    if (!stopped) {
      await closeAfterClassicLeaseFailure(contender, primaryError)
    }
  }
}
