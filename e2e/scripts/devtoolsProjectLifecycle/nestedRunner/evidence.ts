import type { MachineE2ELeaseRecoveryScope } from '../../../../packages/devtools-runtime/src/lease/machineRecoveryState'
import type { SessionEvidence } from '../context'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mutateLease } from '../../../../packages/devtools-runtime/src/lease/directory'
import { machineStateDirectory } from '../../../../packages/devtools-runtime/src/lease/machineContext'
import { readMachineSnapshot } from '../../../../packages/devtools-runtime/src/lease/machineRecoveryState'
import { INHERITED_LEASE_ENV, parseMachineCredential } from '../../../../packages/devtools-runtime/src/lease/machineScope'
import { isRecord } from '../context'

export const NESTED_READY_PREFIX = 'DEVTOOLS_LIFECYCLE_NESTED_RUNNER_READY:'

export interface NestedRunnerReady extends SessionEvidence {
  pid: number
  scope: MachineE2ELeaseRecoveryScope
}

/** 在租约短临界区内读取本能力的子树；不读取或推导其他任务的清理权限。 */
export async function readNestedRunnerScopes(environment: NodeJS.ProcessEnv) {
  const credential = parseMachineCredential(environment[INHERITED_LEASE_ENV] ?? '')
  const scopeId = credential.scopes.at(-1)
  assert(scopeId, 'Nested runner requires an explicit command scope')
  const directory = path.join(machineStateDirectory({}), 'machine-e2e')
  return await mutateLease(directory, async () => {
    const snapshot = await readMachineSnapshot(directory)
    const scopes = snapshot.scopes.filter(scope => scope.id === scopeId || scope.ancestors.includes(scopeId))
    const parent = scopes.find(scope => scope.id === scopeId)
    assert(parent, 'Nested runner scope must remain in its machine ledger')
    assert.equal(parent.owner.pid, credential.pid)
    assert.deepEqual(parent.ancestors, credential.scopes.slice(0, -1))
    return { scopeId, scopes, borrowers: snapshot.borrowers.filter(borrower => borrower.scopes.includes(scopeId)) }
  })
}

export function parseNestedRunnerReady(line: string): NestedRunnerReady {
  const value: unknown = JSON.parse(line.slice(NESTED_READY_PREFIX.length))
  assert(isRecord(value) && Number.isSafeInteger(value.pid) && Number(value.pid) > 0 && Number.isInteger(value.port) && Number(value.port) > 0 && Number(value.port) <= 65535, 'Nested runner returned an invalid process or port')
  for (const key of ['id', 'journalPath', 'projectPath']) {
    assert(typeof value[key] === 'string' && value[key], `Nested runner omitted ${key}`)
  }
  assert(isRecord(value.info) && typeof value.info.version === 'string' && typeof value.info.SDKVersion === 'string', 'Nested runner omitted runtime evidence')
  assert(isRecord(value.scope) && typeof value.scope.id === 'string' && typeof value.scope.cleanupKey === 'string', 'Nested runner omitted its task scope binding')
  assert(value.scope.sealed === false && value.scope.completed === false, 'Nested runner must report an unfinished, unsealed task scope')
  return value as unknown as NestedRunnerReady
}

/** 子进程回执必须与父能力、磁盘登记及明确的下一层任务日志相符。 */
export function assertNestedRunnerReady(evidence: NestedRunnerReady, state: Awaited<ReturnType<typeof readNestedRunnerScopes>>, journalPath: string, pid: number | undefined) {
  assert.equal(evidence.pid, pid, 'Ready message must belong to the created nested runner')
  assert.equal(path.dirname(evidence.journalPath), path.join(journalPath, 'children'), 'Nested task journal must be a direct child of the owned runner journal')
  const parent = state.scopes.find(scope => scope.id === state.scopeId)
  assert(parent, 'Nested runner scope must remain registered')
  const child = state.scopes.find(scope => scope.id === evidence.scope.id)
  assert(child, 'Nested task scope must remain registered beneath the runner')
  assert.equal(parent.cleanupKey, journalPath)
  assert.equal(state.scopes.length, 2, 'Real suite runner must create exactly one unfinished descendant task scope')
  assert.deepEqual(child, evidence.scope, 'Ready task scope must match the machine ledger')
  assert.deepEqual(child.ancestors, [...parent.ancestors, parent.id])
  assert.equal(child.cleanupKey, evidence.journalPath)
  assert(state.scopes.every(scope => !scope.sealed && !scope.completed), 'SIGKILL must leave genuinely unsealed command scopes')
  assert(state.borrowers.some(borrower => borrower.pid === pid && borrower.scopes.at(-1) === child.id), 'Nested task must have a registered live borrower in its child scope')
}

/** 双销毁和端口另行验收；这里独立核对整棵原始 scope 子树已完成。 */
export function assertNestedRunnerScopesCompleted(before: Awaited<ReturnType<typeof readNestedRunnerScopes>>, after: Awaited<ReturnType<typeof readNestedRunnerScopes>>) {
  assert.equal(after.scopeId, before.scopeId)
  assert.deepEqual(after.scopes.map(scope => scope.id).sort(), before.scopes.map(scope => scope.id).sort())
  assert(after.scopes.every(scope => scope.sealed && scope.completed), 'Nested runner recovery must seal and complete every original command scope')
}
