import type { BigIntStats } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import { lstat, mkdir, open, rmdir, unlink } from 'node:fs/promises'
import process from 'node:process'

export interface SessionLock {
  assertOwned: () => Promise<void>
  release: () => Promise<void>
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function sameFile(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino
}

async function currentOwner(filename: string, identity: BigIntStats): Promise<boolean> {
  try {
    const current = await lstat(filename, { bigint: true })
    return current.isFile() && sameFile(current, identity)
  }
  catch (error) {
    if (isMissing(error)) {
      return false
    }
    throw error
  }
}

async function heldLock(filename: string, handle: FileHandle): Promise<SessionLock> {
  const identity = await handle.stat({ bigint: true })
  let released = false
  let releasing: Promise<void> | undefined
  return {
    async assertOwned() {
      if (released || !await currentOwner(filename, identity)) {
        throw new Error('Session lock ownership was lost; refusing to write the journal.')
      }
    },
    release() {
      if (!releasing) {
        released = true
        releasing = (async () => {
          try {
            if (await currentOwner(filename, identity)) {
              await unlink(filename).catch((error: unknown) => {
                if (!isMissing(error)) {
                  throw error
                }
              })
            }
          }
          finally {
            await handle.close()
          }
        })()
      }
      return releasing
    },
  }
}

async function createLock(filename: string): Promise<SessionLock> {
  const handle = await open(filename, 'wx', 0o600)
  let lock: SessionLock | undefined
  try {
    lock = await heldLock(filename, handle)
    await handle.writeFile(String(process.pid))
    await handle.sync()
    await lock.assertOwned()
    return lock
  }
  catch (error) {
    if (lock) {
      await lock.release()
    }
    else {
      await handle.close()
    }
    throw error
  }
}

/** 只有已持有回收互斥锁的调用者才能读取、核实和回收失效的旧锁。 */
async function reclaimLock(filename: string): Promise<SessionLock> {
  const snapshot = await lstat(filename, { bigint: true })
  if (!snapshot.isFile()) {
    throw new Error('Session lock is not a regular file; inspect it before removing it.')
  }
  const handle = await open(filename, 'r')
  try {
    const identity = await handle.stat({ bigint: true })
    if (!sameFile(snapshot, identity) || !await currentOwner(filename, identity)) {
      throw new Error('Session lock changed during recovery; inspect it before retrying.')
    }
    const raw = (await handle.readFile('utf8')).trim()
    const pid = Number(raw)
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(pid)) {
      throw new Error('Session lock is invalid; inspect it before removing it.')
    }
    try {
      process.kill(pid, 0)
      throw new Error('Session is already active in another process.')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        throw error
      }
    }
    if (!await currentOwner(filename, identity)) {
      throw new Error('Session lock changed during recovery; inspect it before retrying.')
    }
    await unlink(filename)
  }
  finally {
    await handle.close()
  }
  return createLock(filename)
}

async function releaseRecoveryGuard(guard: string, identity: BigIntStats): Promise<void> {
  const current = await lstat(guard, { bigint: true })
  if (!current.isDirectory() || !sameFile(current, identity)) {
    throw new Error('Session recovery guard ownership was lost; inspect it before retrying.')
  }
  await rmdir(guard)
}

/** 串行化抢占和回收；未知回收目录不按时间或 PID 推断归属。 */
export async function acquireSessionLock(filename: string): Promise<SessionLock> {
  const lockfile = `${filename}.lock`
  const guard = `${lockfile}.reclaim`
  try {
    await mkdir(guard, { mode: 0o700 })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Session lock recovery is in progress or was interrupted; inspect the recovery guard before retrying.')
    }
    throw error
  }
  const guardIdentity = await lstat(guard, { bigint: true })
  let lock: SessionLock | undefined
  try {
    try {
      try {
        lock = await createLock(lockfile)
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }
        lock = await reclaimLock(lockfile)
      }
    }
    finally {
      await releaseRecoveryGuard(guard, guardIdentity)
    }
    return lock
  }
  catch (error) {
    await lock?.release()
    throw error
  }
}
