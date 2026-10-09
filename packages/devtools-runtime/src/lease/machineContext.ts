import type { MachineE2ELease, MachineE2ELeaseOptions } from './machine'
import { AsyncLocalStorage } from 'node:async_hooks'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { INHERITED_LEASE_ENV } from './machineScope'

const currentMachineLease = new AsyncLocalStorage<{ directory: string, lease: MachineE2ELease }>()
const publishedCredentials = new WeakMap<NodeJS.ProcessEnv, { value: string, previous?: string, users: number }>()

export function machineStateDirectory(options: MachineE2ELeaseOptions) {
  return path.resolve(options.stateDirectory ?? path.join(homedir(), '.local', 'state', 'weapp-agent'))
}

/** 同一凭证仅由最后退出的作用域恢复，避免并发嵌套过早移除父进程环境。 */
function publishCredential(environment: NodeJS.ProcessEnv, value: string) {
  let published = publishedCredentials.get(environment)
  if (!published) {
    if (environment[INHERITED_LEASE_ENV] === value) {
      return () => {}
    }
    published = { value, previous: environment[INHERITED_LEASE_ENV], users: 0 }
    publishedCredentials.set(environment, published)
    environment[INHERITED_LEASE_ENV] = value
  }
  if (published.value !== value) {
    throw new Error('Runtime busy: another machine lease scope owns this process environment.')
  }
  published.users++
  return () => {
    if (--published.users > 0) {
      return
    }
    publishedCredentials.delete(environment)
    if (environment[INHERITED_LEASE_ENV] !== published.value) {
      return
    }
    if (published.previous === undefined) {
      delete environment[INHERITED_LEASE_ENV]
    }
    else {
      environment[INHERITED_LEASE_ENV] = published.previous
    }
  }
}

export function inheritedMachineEnvironment(options: MachineE2ELeaseOptions) {
  const environment = options.env ?? process.env
  const active = currentMachineLease.getStore()
  if (active?.directory === machineStateDirectory(options) && !active.lease.released) {
    return { ...environment, ...active.lease.environment }
  }
  if (publishedCredentials.has(environment)) {
    // 另一个异步调用链发布的凭证不能授予当前调用链嵌套权限。
    const inherited = { ...environment }
    delete inherited[INHERITED_LEASE_ENV]
    return inherited
  }
  return environment
}

/** 只发布当前持有者上下文；调用方决定何时释放，失败恢复不能隐式完成租约。 */
export async function withMachineLeaseContext<T>(lease: MachineE2ELease, run: () => Promise<T>, options: MachineE2ELeaseOptions) {
  const restore = publishCredential(options.env ?? process.env, lease.environment[INHERITED_LEASE_ENV]!)
  try {
    return await currentMachineLease.run({ directory: machineStateDirectory(options), lease }, run)
  }
  finally {
    restore()
  }
}
