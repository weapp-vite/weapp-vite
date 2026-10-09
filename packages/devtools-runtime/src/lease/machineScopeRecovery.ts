import type { MachineE2ELeaseRecoveryScope, MachineE2ELeaseSnapshot } from './machineRecoveryState'
import type { MachineCredential } from './machineScope'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { isProcessAlive, mutateLease } from './directory'
import { readMachineSnapshot, recoveryScopeCopy } from './machineRecoveryState'
import { assertMachineCredential } from './machineScope'

export interface MachineE2ERecoverableDescendantScope extends MachineE2ELeaseRecoveryScope {
  readonly cleanupKey: string
}

const activeRecoveries = new Map<string, Set<MachineCredential>>()

/** 活借用登记阻止跨进程接管；进程内保留的父子能力还需防止重叠回调。 */
function claimSubtree(directory: string, credential: MachineCredential) {
  let active = activeRecoveries.get(directory)
  if (!active) {
    active = new Set()
    activeRecoveries.set(directory, active)
  }
  if ([...active].some(other => other.scopes.includes(credential.token) || credential.scopes.includes(other.token))) {
    throw new Error('Runtime busy: overlapping machine descendant recovery is already in progress.')
  }
  active.add(credential)
  return () => {
    active.delete(credential)
    if (!active.size) {
      activeRecoveries.delete(directory)
    }
  }
}

function subtree(snapshot: MachineE2ELeaseSnapshot, token: string): MachineE2ELeaseSnapshot {
  return {
    owner: snapshot.owner,
    scopes: snapshot.scopes.filter(scope => scope.id === token || scope.ancestors.includes(token)),
    borrowers: snapshot.borrowers.filter(borrower => borrower.scopes.includes(token)),
  }
}

function assertStopped(snapshot: MachineE2ELeaseSnapshot) {
  if (snapshot.borrowers.some(borrower => isProcessAlive(borrower.pid))) {
    throw new Error('Runtime busy: an E2E command child is still running; preserve its journal before descendant recovery.')
  }
}

async function writeScope(directory: string, scope: MachineE2ELeaseRecoveryScope) {
  const { id, ...record } = scope
  await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify(record), { mode: 0o600 })
}

/** 父能力只接管本子树；未登记清理标识、未知借用者或未确认停止均不能推导清理权。 */
async function recoverSubtree(
  directory: string,
  credential: MachineCredential,
  run: (scope: MachineE2ERecoverableDescendantScope) => Promise<void>,
): Promise<void> {
  const token = credential.scopes.at(-1)
  if (!token) {
    throw new Error('Descendant recovery requires an explicit parent command scope.')
  }
  let expected = await mutateLease(directory, async () => {
    await assertMachineCredential(directory, credential, true)
    let selected = subtree(await readMachineSnapshot(directory), token)
    const parent = selected.scopes.find(scope => scope.id === token)!
    if (!parent.sealed) {
      await writeScope(directory, { ...parent, sealed: true })
      selected = subtree(await readMachineSnapshot(directory), token)
    }
    // 封存父入口与核验借用者在同一锁内，已取得的借用者仍必须真正退出。
    assertStopped(selected)
    const pending = selected.scopes.filter(scope => scope.id !== token && !scope.completed)
    if (pending.some(scope => !scope.cleanupKey)) {
      throw new Error('Machine descendant recovery requires an explicit cleanupKey for every unfinished descendant.')
    }
    for (const scope of pending) {
      if (!scope.sealed) {
        await writeScope(directory, { ...scope, sealed: true })
      }
    }
    return subtree(await readMachineSnapshot(directory), token)
  })

  const assertUnchanged = async () => {
    await assertMachineCredential(directory, credential, true)
    const actual = subtree(await readMachineSnapshot(directory), token)
    if (!isDeepStrictEqual(actual, expected)) {
      throw new Error('Machine descendant recovery snapshot changed; preserve unexpected scopes, bindings, or borrowers.')
    }
    assertStopped(actual)
  }
  const pending = expected.scopes.filter(scope => scope.id !== token && !scope.completed)
    .sort((left, right) => right.ancestors.length - left.ancestors.length)
  for (const scope of pending) {
    await mutateLease(directory, assertUnchanged)
    await run(recoveryScopeCopy(scope) as MachineE2ERecoverableDescendantScope)
    await mutateLease(directory, async () => {
      await assertUnchanged()
      await writeScope(directory, { ...scope, completed: true })
      expected = { ...expected, scopes: expected.scopes.map(item => item.id === scope.id ? { ...item, completed: true } : item) }
    })
  }
  await mutateLease(directory, assertUnchanged)
}

/** 已确认停止的子树串行接管，失败释放当前进程的回调占用但保留磁盘证据。 */
export async function recoverStoppedDescendantScopes(
  directory: string,
  credential: MachineCredential,
  run: (scope: MachineE2ERecoverableDescendantScope) => Promise<void>,
): Promise<void> {
  const releaseClaim = claimSubtree(directory, credential)
  try {
    await recoverSubtree(directory, credential, run)
  }
  finally {
    releaseClaim()
  }
}
