import type { MachineCredential, MachineE2EChildScope } from './machineScope'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { acquireDirectoryLease, mutateLease, readLeaseOwner } from './directory'
import { inheritedMachineEnvironment, machineStateDirectory, withMachineLeaseContext } from './machineContext'
import { assertMachineCredential, createMachineChildScope, INHERITED_LEASE_ENV, parseMachineCredential } from './machineScope'

export type { MachineE2EChildScope } from './machineScope'

export interface MachineE2ELeaseOptions {
  /** 仅供隔离测试或嵌入方显式选择；不从工作目录或用户配置环境变量推导。 */
  stateDirectory?: string
  env?: NodeJS.ProcessEnv
}

export interface MachineE2ELease {
  borrowed: boolean
  released: boolean
  environment: NodeJS.ProcessEnv
  createChildScope: () => Promise<MachineE2EChildScope>
  release: () => Promise<void>
}

/** 同机同用户的所有 E2E 共用一个租约，子进程凭磁盘核验过的能力票据借用。 */
export async function acquireMachineE2ELease(options: MachineE2ELeaseOptions = {}): Promise<MachineE2ELease> {
  const state = machineStateDirectory(options)
  const directory = path.join(state, 'machine-e2e')
  const inherited = (options.env ?? process.env)[INHERITED_LEASE_ENV]
  if (!inherited) {
    const owned = await acquireDirectoryLease(directory, 'Runtime busy: another E2E operation owns this machine. Wait for its owner to finish before retrying.')
    return {
      borrowed: false,
      get released() { return owned.released },
      environment: { [INHERITED_LEASE_ENV]: JSON.stringify(owned.owner) },
      createChildScope: () => createMachineChildScope(directory, { ...owned.owner, scopes: [] }, () => !owned.released),
      release: owned.release,
    }
  }

  let credential: MachineCredential
  try {
    credential = parseMachineCredential(inherited)
  }
  catch {
    throw new Error('Runtime busy: inherited E2E lease is invalid; refusing to bypass the machine lock.')
  }
  const member = { pid: process.pid, token: randomUUID(), scopes: credential.scopes }
  const memberFile = path.join(directory, 'borrowers', `${member.token}.json`)
  await mkdir(state, { recursive: true, mode: 0o700 })
  await mutateLease(directory, async () => {
    await assertMachineCredential(directory, credential)
    await mkdir(path.dirname(memberFile), { recursive: true, mode: 0o700 })
    await writeFile(memberFile, JSON.stringify(member), { mode: 0o600 })
  })

  let releasing: Promise<void> | undefined
  const lease: MachineE2ELease = {
    borrowed: true,
    released: false,
    environment: { [INHERITED_LEASE_ENV]: inherited },
    createChildScope: () => createMachineChildScope(directory, credential, () => !lease.released),
    release: () => {
      if (lease.released) {
        return Promise.resolve()
      }
      releasing ??= mutateLease(directory, async () => {
        const registered = await readLeaseOwner(memberFile)
        if (registered?.token !== member.token || registered.pid !== member.pid) {
          throw new Error('Runtime lease borrower ownership changed; refusing cleanup.')
        }
        await rm(memberFile)
        lease.released = true
      }).finally(() => { releasing = undefined })
      return releasing
    },
  }
  return lease
}

/** 入口持有租约到子任务与清理全部完成，嵌套入口仅释放自己的登记。 */
export async function withMachineE2ELease<T>(run: (lease: MachineE2ELease) => Promise<T>, options: MachineE2ELeaseOptions = {}): Promise<T> {
  const lease = await acquireMachineE2ELease({ ...options, env: inheritedMachineEnvironment(options) })
  let entered = false
  try {
    return await withMachineLeaseContext(lease, async () => {
      entered = true
      try {
        return await run(lease)
      }
      finally {
        await lease.release()
      }
    }, options)
  }
  finally {
    if (!entered) {
      await lease.release()
    }
  }
}
