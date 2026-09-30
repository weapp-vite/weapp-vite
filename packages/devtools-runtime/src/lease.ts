import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

export interface RuntimeLease {
  root: string
  token: string
  released: boolean
  release: () => Promise<void>
}
const currentLease = new AsyncLocalStorage<RuntimeLease>()
/** 同一真实工程跨进程互斥；未知持有者不自动回收。 */
export async function acquireRuntimeLease(projectRoot: string): Promise<RuntimeLease> {
  const root = await realpath(projectRoot)
  const directory = path.join(process.env.WEAPP_AGENT_STATE_DIR ?? path.join(homedir(), '.local', 'state', 'weapp-agent'), 'runtime-locks')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const lock = path.join(directory, createHash('sha256').update(root).digest('hex'))
  try {
    await mkdir(lock)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
    const recovery = `${lock}.recovery`
    try {
      await mkdir(recovery)
    }
    catch {
      throw new Error('Runtime busy: project lock recovery is in progress.')
    }
    try {
      const owner = await readFile(path.join(lock, 'owner.json'), 'utf8').then(JSON.parse).catch(() => undefined)
      let alive = true
      if (Number.isInteger(owner?.pid) && owner.pid > 0) {
        try {
          process.kill(owner.pid, 0)
        }
        catch (e) {
          alive = (e as NodeJS.ErrnoException).code !== 'ESRCH'
        }
      }
      if (alive) {
        throw new Error('Runtime busy: another operation owns this project. Query or cancel its acceptance task first.')
      }
      await rm(lock, { recursive: true })
    }
    finally {
      await rm(recovery, { recursive: true })
    }
    return acquireRuntimeLease(root)
  }
  const token = randomUUID()
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, token }), { mode: 0o600 })
  const lease: RuntimeLease = { root, token, released: false, release: async () => {
    if (lease.released) {
      return
    }
    const owner = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8'))
    if (owner.token !== token) {
      throw new Error('Runtime lease ownership changed; refusing cleanup.')
    }
    lease.released = true
    await rm(lock, { recursive: true })
  } }
  return lease
}
export function runWithRuntimeLease<T>(lease: RuntimeLease, run: () => Promise<T>): Promise<T> {
  if (lease.released) {
    throw new Error('Runtime lease already released')
  }
  return currentLease.run(lease, run)
}
export async function withRuntimeLease<T>(projectRoot: string, run: () => Promise<T>): Promise<T> {
  const root = await realpath(projectRoot)
  const active = currentLease.getStore()
  if (active?.root === root && !active.released) {
    return run()
  }
  const lease = await acquireRuntimeLease(root)
  try {
    return await runWithRuntimeLease(lease, run)
  }
  finally {
    await lease.release()
  }
}
