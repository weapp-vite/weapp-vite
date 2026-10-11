import type { MachineCredential, MachineE2EChildScope, MachineE2EChildScopeOptions } from './machineScope'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { acquireDirectoryLease, mutateLease, readLeaseOwner } from './directory'
import { inheritedMachineEnvironment, machineStateDirectory, withMachineLeaseContext } from './machineContext'
import { assertMachineCredential, createMachineChildScope, INHERITED_LEASE_ENV, parseMachineCredential } from './machineScope'

export type { MachineE2EChildScope, MachineE2EChildScopeOptions, MachineE2ERecoverableDescendantScope } from './machineScope'

export interface MachineE2ELeaseOptions {
  /** 仅供隔离测试或嵌入方显式选择；不从工作目录或用户配置环境变量推导。 */
  stateDirectory?: string
  env?: NodeJS.ProcessEnv
}

export interface MachineE2ELease {
  borrowed: boolean
  released: boolean
  environment: NodeJS.ProcessEnv
  createChildScope: (options?: MachineE2EChildScopeOptions) => Promise<MachineE2EChildScope>
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
      createChildScope: options => createMachineChildScope(directory, { ...owned.owner, scopes: [] }, () => !owned.released, options),
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
    createChildScope: options => createMachineChildScope(directory, credential, () => !lease.released, options),
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

/** 入口持有租约到清理完成；执行与释放同时失败时保留两者，嵌套入口仅释放自己的登记。 */
export async function withMachineE2ELease<T>(run: (lease: MachineE2ELease) => Promise<T>, options: MachineE2ELeaseOptions = {}): Promise<T> {
  const lease = await acquireMachineE2ELease({ ...options, env: inheritedMachineEnvironment(options) })
  let entered = false
  let failure: { error: unknown } | undefined
  const release = async () => {
    try {
      await lease.release()
    }
    catch (releaseError) {
      if (failure) {
        throw new AggregateError([failure.error, releaseError], 'E2E operation failed and machine lease cleanup did not complete.', { cause: failure.error })
      }
      throw releaseError
    }
  }
  try {
    return await withMachineLeaseContext(lease, async () => {
      entered = true
      try {
        return await run(lease)
      }
      catch (error) {
        failure = { error }
        throw error
      }
      finally {
        await release()
      }
    }, options)
  }
  catch (error) {
    failure = { error }
    throw error
  }
  finally {
    if (!entered) {
      await release()
    }
  }
}
