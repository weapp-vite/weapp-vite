import { AsyncLocalStorage } from 'node:async_hooks'
import process from 'node:process'

interface KernelOperation {
  cancel: () => void
  settled: Promise<unknown>
  recoveryOwner?: object
}

export interface WindowsKernelQueryScope {
  closing: boolean
  pending: Set<KernelOperation>
  owners: Map<object, { released: ReturnType<typeof Promise.withResolvers<void>>, pid?: number, failure?: unknown }>
  drain?: Promise<void>
}

const context = new AsyncLocalStorage<{ scope: WindowsKernelQueryScope, recoveryOwner?: object }>()
let current: WindowsKernelQueryScope = { closing: false, pending: new Set(), owners: new Map() }

export function currentWindowsKernelQueryScope(): WindowsKernelQueryScope {
  return context.getStore()?.scope ?? current
}

/** 新模块只能在上一代操作全部排空后建立；旧 continuation 继续绑定其关闭代次。 */
export function beginWindowsKernelQueryScope(): WindowsKernelQueryScope {
  if (current.pending.size || current.owners.size) {
    throw new Error('Previous Windows kernel query scope still owns dev resources or pending operations.')
  }
  current = { closing: false, pending: new Set(), owners: new Map() }
  return current
}

export function inWindowsKernelQueryScope<T>(scope: WindowsKernelQueryScope, operation: () => T): T {
  const inherited = context.getStore()
  return context.run(inherited?.scope === scope ? inherited : { scope }, operation)
}

/** owner 与现有 dev disposer 同时取得、同时释放，不以停止 Promise 结算替代资源退出。 */
export function holdWindowsKernelOwner(scope: WindowsKernelQueryScope, pid?: number): object {
  if (scope.closing) {
    throw new Error('Cannot start a dev owner in a closing kernel query scope.')
  }
  const owner = {}
  scope.owners.set(owner, { released: Promise.withResolvers<void>(), pid })
  return owner
}

export function releaseWindowsKernelOwner(scope: WindowsKernelQueryScope, owner: object): void {
  scope.owners.get(owner)?.released.resolve()
  scope.owners.delete(owner)
}

export function recordWindowsKernelOwnerFailure(scope: WindowsKernelQueryScope, owner: object, failure: unknown): void {
  const record = scope.owners.get(owner)
  if (record && record.failure === undefined) {
    record.failure = failure
  }
}

export function inWindowsKernelOwnerRecovery<T>(scope: WindowsKernelQueryScope, owner: object, operation: () => T): T {
  if (!scope.owners.has(owner)) {
    throw new Error('Dev recovery requires the original registered owner.')
  }
  return context.run({ scope, recoveryOwner: owner }, operation)
}

export function canDispatchWindowsKernelQuery(scope: WindowsKernelQueryScope): boolean {
  const owner = context.getStore()?.recoveryOwner
  return !scope.closing || Boolean(owner && scope.owners.has(owner))
}

export function registerWindowsKernelOperation(scope: WindowsKernelQueryScope, operation: KernelOperation, recoveryOwner = context.getStore()?.recoveryOwner): void {
  if (recoveryOwner && scope.owners.has(recoveryOwner)) {
    operation.recoveryOwner = recoveryOwner
  }
  scope.pending.add(operation)
  void operation.settled.then(() => scope.pending.delete(operation), () => scope.pending.delete(operation))
  if (scope.closing && !operation.recoveryOwner) {
    operation.cancel()
  }
}

/** 先冻结本代入口，再取消并等待登记工作；下一代不获得旧 continuation 的权限。 */
export function closeWindowsKernelQueryScope(scope: WindowsKernelQueryScope, reason: unknown): Promise<void> {
  if (scope.drain) {
    return scope.drain
  }
  scope.closing = true
  scope.drain = (async () => {
    const failures: unknown[] = [...scope.owners.values()].flatMap(owner => owner.failure === undefined ? [] : [owner.failure])
    while (scope.pending.size || scope.owners.size) {
      const operations = [...scope.pending]
      for (const operation of operations) {
        if (!operation.recoveryOwner) {
          operation.cancel()
        }
      }
      const results = await Promise.allSettled(operations.map(operation => operation.settled))
      failures.push(...results.flatMap(result => result.status === 'rejected' ? [result.reason] : []))
      if (scope.owners.size) {
        const owners = [...scope.owners.values()]
        try {
          process.stderr.write(`[e2e-kernel-scope] ${JSON.stringify({
            stage: 'waiting-owned-dev',
            pending: scope.pending.size,
            owners: owners.map(owner => ({ pid: owner.pid ?? null, failure: owner.failure instanceof Error ? { name: owner.failure.name, message: owner.failure.message } : String(owner.failure ?? 'none') })),
          })}\n`)
        }
        catch {
          // 诊断写出失败不能解除 owner，也不能跳过原生资源终结等待。
        }
        await Promise.all(owners.map(owner => owner.released.promise))
        for (const owner of owners) {
          if (owner.failure !== undefined && !failures.includes(owner.failure)) {
            failures.push(owner.failure)
          }
        }
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, 'Windows kernel queries were cancelled and drained.', { cause: reason })
    }
  })()
  return scope.drain
}
