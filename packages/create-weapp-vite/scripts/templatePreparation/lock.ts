import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { createOwner, ownerExited, readOwner, removeOwnedFile } from './owner'

interface LockOptions {
  timeoutMs?: number
  pollMs?: number
}

async function exists(file: string) {
  try {
    await fs.lstat(file)
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function recoverExitedOwner(file: string, root: string) {
  const previous = await readOwner(file, root)
  if (!previous || !ownerExited(previous)) {
    return
  }
  // 串行化旧锁回收，避免两个回收者先后删除新持有者的锁。
  // 若回收本身被强杀，保留带身份的标记供人工核验，不猜测或递归删除锁。
  const recoveryFile = `${file}.recovery`
  const recoveryOwner = createOwner(root)
  let recovery
  try {
    recovery = await fs.open(recoveryFile, 'wx')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return
    }
    throw error
  }
  try {
    await recovery.writeFile(JSON.stringify(recoveryOwner))
    const current = await readOwner(file, root)
    if (current?.token === previous.token && ownerExited(current)) {
      await fs.unlink(file)
    }
  }
  finally {
    await recovery.close()
    await removeOwnedFile(recoveryFile, recoveryOwner)
  }
}

/** 用进程身份保护准备流程；活锁、旧格式锁和归属未知的回收标记一律保留。 */
export async function withPreparationLock<T>(directory: string, action: () => Promise<T>, options: LockOptions = {}): Promise<T> {
  await fs.mkdir(directory, { recursive: true })
  const root = await fs.realpath(directory)
  const file = path.join(root, '.vite-plus.lock')
  const owner = createOwner(root)
  const deadline = Date.now() + (options.timeoutMs ?? 60_000)
  const pollMs = options.pollMs ?? 100
  for (;;) {
    if (!await exists(`${file}.recovery`)) {
      let handle
      try {
        handle = await fs.open(file, 'wx')
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }
      }
      if (handle) {
        try {
          await handle.writeFile(JSON.stringify(owner))
          return await action()
        }
        finally {
          await handle.close()
          await removeOwnedFile(file, owner)
        }
      }
      await recoverExitedOwner(file, root)
    }
    if (Date.now() >= deadline) {
      throw new Error('等待 Vite Plus 模板准备锁超时：活动进程或归属未知的锁/回收标记已保留，请核查其 pid、startedAt 和 root。')
    }
    await setTimeout(pollMs)
  }
}
