import type { MachineE2ELease, MachineE2ELeaseOptions } from './machine'
import type { MachineE2ELeaseRecoveryScope, MachineE2ELeaseSnapshot } from './machineRecoveryState'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { mutateLease } from './directory'
import { machineStateDirectory, withMachineLeaseContext } from './machineContext'
import { assertMachineSnapshot, assertRecoveryNode, assertSnapshotStopped, readMachineSnapshot, recoveryScopeCopy } from './machineRecoveryState'
import { INHERITED_LEASE_ENV } from './machineScope'

export type { MachineE2ELeaseRecoveryScope, MachineE2ELeaseSnapshot } from './machineRecoveryState'

interface RecoveryContext {
  directory: string
  snapshot: MachineE2ELeaseSnapshot
  scope: MachineE2ELeaseRecoveryScope
  active: boolean
  operations: Set<Promise<unknown>>
}

const currentRecovery = new AsyncLocalStorage<RecoveryContext>()

export interface MachineE2ELeaseRecoveryOptions extends MachineE2ELeaseOptions {
  expected: MachineE2ELeaseSnapshot
  /** 必须绑定已核验的资源日志并完成清理；仅此回调成功才允许完成对应 scope。 */
  recoverScope: (scope: MachineE2ELeaseRecoveryScope) => Promise<void>
}

export interface MachineE2ELeaseRecoveryResult {
  auditFile: string
  recoveredScopes: string[]
}

/** 读取供显式恢复核对的精确登记快照，不修改租约或推导资源清理权限。 */
export async function readMachineE2ELeaseSnapshot(options: MachineE2ELeaseOptions = {}): Promise<MachineE2ELeaseSnapshot> {
  const directory = path.join(machineStateDirectory(options), 'machine-e2e')
  return mutateLease(directory, () => readMachineSnapshot(directory))
}

function activeRecovery(scope: MachineE2ELeaseRecoveryScope) {
  const context = currentRecovery.getStore()
  if (!context?.active || context.scope !== scope
    || context.snapshot.scopes.find(item => item.id === scope.id)?.cleanupKey !== scope.cleanupKey) {
    throw new Error('Machine lease recovery requires the active explicit recovery callback and its original scope.')
  }
  return context
}

/** 核验当前显式恢复回调的原始 scope 与完整接管快照，不授予普通租约额外清理权限。 */
export async function assertMachineE2ELeaseRecoveryScope(scope: MachineE2ELeaseRecoveryScope): Promise<void> {
  const context = activeRecovery(scope)
  await mutateLease(context.directory, async () => {
    activeRecovery(scope)
    await assertMachineSnapshot(context.directory, context.snapshot)
    activeRecovery(scope)
  })
  // 锁获取、快照读取与锁释放均会让出执行权，回调可能已经结束。
  activeRecovery(scope)
}

/** 同步登记完整领域操作；回调漏等候时保留租约，直到在途操作停止后再报告失败。 */
export function withMachineE2ELeaseRecoveryOperation<T>(scope: MachineE2ELeaseRecoveryScope, run: () => Promise<T>): Promise<T> {
  let context: RecoveryContext
  try {
    context = activeRecovery(scope)
  }
  catch (error) {
    return Promise.reject(error)
  }
  const operation = (async () => {
    await assertMachineE2ELeaseRecoveryScope(scope)
    const result = await run()
    await assertMachineE2ELeaseRecoveryScope(scope)
    return result
  })()
  context.operations.add(operation)
  void operation.then(() => context.operations.delete(operation), () => context.operations.delete(operation))
  return operation
}

/**
 * 接管已退出且全部封存的精确租约，按后代优先顺序调用受信清理回调。
 * 回调通过当前根凭证嵌套普通租约，但不能遗留新登记或改变 scope。
 * 失败保留新持有者与未完成 scope，待恢复进程退出后凭新快照重试。
 * 接管中断保留原快照审计；进程崩溃留下的变更锁或混合归属不自动修复。
 */
export async function recoverMachineE2ELease(options: MachineE2ELeaseRecoveryOptions): Promise<MachineE2ELeaseRecoveryResult> {
  const state = machineStateDirectory(options)
  const directory = path.join(state, 'machine-e2e')
  const expected = structuredClone(options.expected)
  const owner = { pid: process.pid, token: randomUUID() }
  const auditFile = path.join(state, 'machine-e2e-recoveries', `${owner.token}.jsonl`)
  const adopted: MachineE2ELeaseSnapshot = { ...expected, owner, scopes: expected.scopes.map(scope => ({ ...scope, owner })) }
  const record = (event: Record<string, unknown>) => appendFile(auditFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, { mode: 0o600 })
  await mutateLease(directory, async () => {
    await assertMachineSnapshot(directory, expected)
    assertSnapshotStopped(expected, true)
    await mkdir(path.dirname(auditFile), { recursive: true, mode: 0o700 })
    await assertRecoveryNode(path.dirname(auditFile), 'directory')
    await writeFile(auditFile, `${JSON.stringify({ event: 'adopting', at: new Date().toISOString(), expected, owner })}\n`, { mode: 0o600, flag: 'wx' })
    for (const scope of adopted.scopes) {
      const { id, ...value } = scope
      await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify(value), { mode: 0o600 })
    }
    await writeFile(path.join(directory, 'owner.json'), JSON.stringify(owner), { mode: 0o600 })
    await record({ event: 'adopted' })
  })

  let snapshot = adopted
  const recoveredScopes: string[] = []
  const lease: MachineE2ELease = {
    borrowed: false,
    released: false,
    environment: { [INHERITED_LEASE_ENV]: JSON.stringify(owner) },
    createChildScope: async () => { throw new Error('Recovery callbacks must not create command scopes.') },
    release: () => mutateLease(directory, async () => {
      await assertMachineSnapshot(directory, snapshot)
      if (snapshot.scopes.some(scope => !scope.completed)) {
        throw new Error('Machine lease recovery cannot release incomplete scopes.')
      }
      await record({ event: 'releasing', recoveredScopes })
      await rm(directory, { recursive: true })
      lease.released = true
    }),
  }
  try {
    await withMachineLeaseContext(lease, async () => {
      const pending = adopted.scopes.filter(scope => !scope.completed).sort((a, b) => b.ancestors.length - a.ancestors.length)
      for (const scope of pending) {
        await mutateLease(directory, () => assertMachineSnapshot(directory, snapshot))
        const context: RecoveryContext = { directory, snapshot, scope: recoveryScopeCopy(scope), active: true, operations: new Set() }
        let failure: { error: unknown } | undefined
        try {
          await currentRecovery.run(context, () => options.recoverScope(context.scope))
        }
        catch (error) {
          failure = { error }
        }
        finally {
          context.active = false
        }
        const unfinished = [...context.operations]
        if (unfinished.length) {
          // 已发出的文件操作无法撤销，必须等它们结束，且不能据此完成 scope。
          await Promise.allSettled(unfinished)
        }
        if (failure) {
          throw failure.error
        }
        if (unfinished.length) {
          throw new Error('Machine lease recovery callback ended with unfinished recovery operations; preserving its incomplete scope.')
        }
        await mutateLease(directory, async () => {
          await assertMachineSnapshot(directory, snapshot)
          const { id, ...value } = scope
          await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify({ ...value, completed: true }), { mode: 0o600 })
          snapshot = { ...snapshot, scopes: snapshot.scopes.map(item => item.id === id ? { ...item, completed: true } : item) }
          recoveredScopes.push(id)
          await record({ event: 'scope-completed', scopeId: id })
        })
      }
      await lease.release()
    }, options)
    return { auditFile, recoveredScopes }
  }
  catch (error) {
    // 审计写入失败也不能覆盖清理回调的原始错误，更不能因此完成 scope。
    await record({ event: 'failed', error: error instanceof Error ? error.message : String(error) }).catch(() => {})
    throw error
  }
}
