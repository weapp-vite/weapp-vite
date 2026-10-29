import { randomUUID } from 'node:crypto'
import fsNative from 'node:fs/promises'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { classicIdeConfigLeasePath } from './leases'

interface LockOwner {
  pid: number
  token: string
}

const tokenPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu
const contentionCodes = new Set(['EEXIST', 'ENOTEMPTY', 'EPERM'])

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code
}

function lockError(guard: string, reason: string, cause?: unknown) {
  return Object.assign(new Error(`[weapp-vite] classic IDE 配置互斥记录${reason}：${guard}。请确认该项目的其他开发命令已退出；未知记录需先备份并按故障排查文档恢复，不要直接删除整个 .weapp-vite 目录。`, { cause }), { code: 'EEXIST' })
}

async function readLock(guard: string): Promise<LockOwner | null | undefined> {
  try {
    const entries = await fs.readdir(guard, { withFileTypes: true })
    if (!entries.length) {
      return null
    }
    const entry = entries[0]!
    if (entries.length !== 1 || !entry.isFile() || !tokenPattern.test(entry.name)) {
      throw lockError(guard, '格式未知，拒绝接管')
    }
    const value: unknown = JSON.parse(await fs.readFile(path.join(guard, entry.name), 'utf8'))
    if (!value || typeof value !== 'object' || !('pid' in value) || !('token' in value)
      || !Number.isSafeInteger(value.pid) || typeof value.pid !== 'number' || value.pid <= 0
      || value.token !== entry.name) {
      throw lockError(guard, '进程身份无效，拒绝接管')
    }
    return { pid: value.pid, token: entry.name }
  }
  catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return undefined
    }
    if (errorCode(error) === 'EEXIST') {
      throw error
    }
    throw lockError(guard, '无法读取或内容损坏，拒绝接管', error)
  }
}

async function removeEmptyLock(guard: string) {
  try {
    await fsNative.rmdir(guard)
  }
  catch (error) {
    if (errorCode(error) === 'ENOENT' || contentionCodes.has(errorCode(error) ?? '')) {
      if (errorCode(error) !== 'EPERM' || await readLock(guard) !== null) {
        return
      }
    }
    throw error
  }
}

/** 只删除观察到的 token；迟到的回收者不能清空后来 owner 的非空目录。 */
async function removeLock(guard: string, token: string, staleDeadline?: number) {
  while (true) {
    try {
      await fsNative.unlink(path.join(guard, token))
      break
    }
    catch (error) {
      if (staleDeadline !== undefined) {
        if (errorCode(error) === 'ENOENT') {
          return
        }
        if (errorCode(error) === 'EPERM') {
          const remaining = staleDeadline - Date.now()
          if (remaining > 0) {
            await delay(Math.min(20, remaining))
            if (Date.now() < staleDeadline) {
              continue
            }
          }
        }
      }
      throw error
    }
  }
  await removeEmptyLock(guard)
}

async function acquireLock(guard: string, candidate: string) {
  const deadline = Date.now() + 1000
  let reason = '正在被其他开发命令修改'
  while (true) {
    try {
      // 候选已完整且非空；POSIX 不能覆盖非空目录，Windows 冲突则回读确认。
      await fsNative.rename(candidate, guard)
      return
    }
    catch (error) {
      if (!contentionCodes.has(errorCode(error) ?? '')) {
        throw error
      }
      const owner = await readLock(guard)
      if (owner === null) {
        await removeEmptyLock(guard)
      }
      else if (owner !== undefined) {
        let dead = false
        try {
          process.kill(owner.pid, 0)
        }
        catch (probeError) {
          if (errorCode(probeError) !== 'ESRCH') {
            throw lockError(guard, `无法确认持有进程 ${owner.pid} 的状态，拒绝接管`, probeError)
          }
          dead = true
        }
        if (dead) {
          await removeLock(guard, owner.token, deadline)
        }
        else {
          reason = `已由其他开发命令持有（PID ${owner.pid}）`
        }
      }
      if (Date.now() >= deadline) {
        // Windows 冲突回执可能晚于对方释放；预算耗尽仍无 owner 时保留原始权限错误。
        if (owner === undefined && errorCode(error) === 'EPERM') {
          throw error
        }
        throw lockError(guard, reason, error)
      }
      await delay(20)
    }
  }
}

/** 把 classic journal 的读取、恢复及发布串行为短事务，异常退出后可安全重获。 */
export async function withClassicIdeConfigLock<T>(configPath: string, run: () => Promise<T>): Promise<T> {
  const guard = `${classicIdeConfigLeasePath(configPath)}.lock`
  await fs.ensureDir(path.dirname(guard))
  const candidate = await fs.mkdtemp(`${guard}.candidate-`)
  const owner: LockOwner = { pid: process.pid, token: randomUUID() }
  let acquired = false
  let failure: { error: unknown } | undefined
  let result: { value: T } | undefined
  let releasing: Promise<void> | undefined
  const release = () => releasing ??= removeLock(guard, owner.token)
  try {
    await fs.writeFile(path.join(candidate, owner.token), JSON.stringify(owner), { flag: 'wx' })
    await acquireLock(guard, candidate)
    acquired = true
    result = { value: await run() }
  }
  catch (error) {
    failure = { error }
  }
  try {
    if (acquired) {
      await release()
    }
    else {
      // 仅此调用创建且从未发布的随机候选允许递归清理。
      await fs.remove(candidate)
    }
  }
  catch (cleanupError) {
    if (failure) {
      throw new AggregateError([failure.error, cleanupError], 'Classic IDE 配置事务及清理均失败', { cause: failure.error })
    }
    throw cleanupError
  }
  if (failure) {
    throw failure.error
  }
  return result!.value
}
