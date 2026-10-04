import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { acquireDirectoryLease } from './lease/directory'

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
  const lock = path.join(directory, createHash('sha256').update(root).digest('hex'))
  const owned = await acquireDirectoryLease(lock, 'Runtime busy: another operation owns this project. Query or cancel its acceptance task first.')
  return {
    root,
    token: owned.owner.token,
    get released() { return owned.released },
    release: owned.release,
  }
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
