import type { MachineE2ELeaseOptions } from './machine'
import type { MachineE2ELeaseSnapshot } from './machineRecoveryState'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { isProcessAlive, mutateLease } from './directory'
import { machineStateDirectory } from './machineContext'
import { assertRecoveryNode, readMachineSnapshot } from './machineRecoveryState'

interface StoppedScopeSealOptions extends MachineE2ELeaseOptions {
  expected: MachineE2ELeaseSnapshot
  cleanupKeys: Readonly<Record<string, string>>
}

function assertStopped(snapshot: MachineE2ELeaseSnapshot) {
  if (isProcessAlive(snapshot.owner.pid) || snapshot.borrowers.some(borrower => isProcessAlive(borrower.pid))) {
    throw new Error('Runtime busy: stopped-scope sealing requires the owner and registered borrowers to have stopped.')
  }
}

/**
 * 内部显式恢复入口：仅封存已停止且逐项绑定清理日志的精确登记。
 * 不接管持有者、不执行清理、不完成 scope；后续仍须通过正式恢复核验资源。
 */
export async function sealStoppedMachineE2ELeaseScopes(options: StoppedScopeSealOptions) {
  const state = machineStateDirectory(options)
  const directory = path.join(state, 'machine-e2e')
  const expected = structuredClone(options.expected)
  const cleanupKeys = structuredClone(options.cleanupKeys)
  return mutateLease(directory, async () => {
    const actual = await readMachineSnapshot(directory)
    if (!isDeepStrictEqual(actual, expected)) {
      throw new Error('Machine stopped-scope sealing snapshot changed; preserving unexpected registration.')
    }
    assertStopped(actual)
    const unfinished = actual.scopes.filter(scope => !scope.completed)
    if (!isDeepStrictEqual(Object.keys(cleanupKeys).sort(), unfinished.map(scope => scope.id).sort())
      || unfinished.some(scope => !scope.cleanupKey || cleanupKeys[scope.id] !== scope.cleanupKey)) {
      throw new Error('Machine stopped-scope sealing requires the exact cleanupKey of every unfinished scope.')
    }
    const pending = unfinished.filter(scope => !scope.sealed)
    if (!pending.length) {
      throw new Error('Machine stopped-scope sealing requires an unsealed command scope.')
    }
    const auditDirectory = path.join(state, 'machine-e2e-seals')
    await mkdir(auditDirectory, { recursive: true, mode: 0o700 })
    await assertRecoveryNode(auditDirectory, 'directory')
    const auditFile = path.join(auditDirectory, `${randomUUID()}.jsonl`)
    await writeFile(auditFile, `${JSON.stringify({ event: 'sealing-stopped', at: new Date().toISOString(), expected, cleanupKeys })}\n`, { mode: 0o600, flag: 'wx' })
    const sealedScopes: string[] = []
    for (const scope of pending) {
      const temporary = path.join(auditDirectory, `${randomUUID()}.json`)
      const { id, ...record } = scope
      // 失败时保留原子写出前的审计输入，不按临时路径推导删除权限或覆盖首错。
      await writeFile(temporary, JSON.stringify({ ...record, sealed: true }), { mode: 0o600, flag: 'wx' })
      assertStopped(actual)
      await rename(temporary, path.join(directory, 'scopes', `${id}.json`))
      sealedScopes.push(id)
      await appendFile(auditFile, `${JSON.stringify({ event: 'scope-sealed', at: new Date().toISOString(), scopeId: id })}\n`)
    }
    const snapshot = await readMachineSnapshot(directory)
    assertStopped(snapshot)
    const sealed = { ...expected, scopes: expected.scopes.map(scope => pending.some(item => item.id === scope.id) ? { ...scope, sealed: true } : scope) }
    if (!isDeepStrictEqual(snapshot, sealed)) {
      throw new Error('Machine stopped-scope sealing inventory changed; refusing to infer completion.')
    }
    return { snapshot, auditFile, sealedScopes }
  })
}
