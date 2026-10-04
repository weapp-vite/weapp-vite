import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'

export interface LeaseOwner {
  pid: number
  token: string
}

export interface DirectoryLease {
  directory: string
  owner: LeaseOwner
  released: boolean
  release: () => Promise<void>
}

export function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

export async function readLeaseOwner(file: string): Promise<LeaseOwner | undefined> {
  const value: unknown = await readFile(file, 'utf8').then(JSON.parse).catch(() => undefined)
  if (!value || typeof value !== 'object' || !('pid' in value) || !('token' in value)
    || !Number.isInteger(value.pid) || Number(value.pid) <= 0 || typeof value.token !== 'string' || !value.token) {
    return undefined
  }
  return { pid: Number(value.pid), token: value.token }
}

/** 注册、释放和过期回收共享短临界区；归属未知的临界区不自动删除。 */
export async function mutateLease<T>(directory: string, run: () => Promise<T>): Promise<T> {
  const guard = `${directory}.recovery`
  for (let attempt = 0; ; attempt++) {
    try {
      await mkdir(guard, { mode: 0o700 })
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
      if (attempt === 20) {
        throw new Error('Runtime busy: lease ownership update or recovery is in progress.')
      }
      await setTimeout(10)
    }
  }
  try {
    return await run()
  }
  finally {
    await rm(guard, { recursive: true })
  }
}

/** 活跃借用方和不完整登记均阻止回收，避免父进程退出后孤儿任务继续运行。 */
export async function assertNoLeaseBorrowers(directory: string) {
  const members = path.join(directory, 'borrowers')
  const files = await readdir(members).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  })
  for (const file of files) {
    const borrower = await readLeaseOwner(path.join(members, file))
    if (!borrower || isProcessAlive(borrower.pid)) {
      throw new Error('Runtime busy: an E2E child operation still owns this machine lease.')
    }
  }
}

/** 目录创建负责原子占用；只有有效且已退出的持有者允许被回收。 */
export async function acquireDirectoryLease(directory: string, busyMessage: string): Promise<DirectoryLease> {
  await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 })
  const owner = { pid: process.pid, token: randomUUID() }
  const create = async () => {
    await mkdir(directory, { mode: 0o700 })
    try {
      await writeFile(path.join(directory, 'owner.json'), JSON.stringify(owner), { mode: 0o600 })
    }
    catch (error) {
      await rm(directory, { recursive: true })
      throw error
    }
  }
  try {
    await create()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
    await mutateLease(directory, async () => {
      const previous = await readLeaseOwner(path.join(directory, 'owner.json'))
      if (!previous || isProcessAlive(previous.pid)) {
        throw new Error(busyMessage)
      }
      await assertNoLeaseBorrowers(directory)
      await rm(directory, { recursive: true })
      try {
        await create()
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Error(busyMessage)
        }
        throw error
      }
    })
  }

  let releasing: Promise<void> | undefined
  const lease: DirectoryLease = {
    directory,
    owner,
    released: false,
    release: () => {
      if (lease.released) {
        return Promise.resolve()
      }
      releasing ??= mutateLease(directory, async () => {
        const current = await readLeaseOwner(path.join(directory, 'owner.json'))
        if (current?.token !== owner.token || current.pid !== owner.pid) {
          throw new Error('Runtime lease ownership changed; refusing cleanup.')
        }
        await assertNoLeaseBorrowers(directory)
        await rm(directory, { recursive: true })
        lease.released = true
      }).finally(() => { releasing = undefined })
      return releasing
    },
  }
  return lease
}
