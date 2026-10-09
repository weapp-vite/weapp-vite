import type { LeaseOwner } from './directory'
import { lstat, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { isProcessAlive } from './directory'
import { parseMachineCredential, readScope } from './machineScope'

export interface MachineE2ELeaseRecoveryScope {
  readonly id: string
  readonly owner: Readonly<LeaseOwner>
  readonly ancestors: readonly string[]
  readonly sealed: boolean
  readonly completed: boolean
  readonly cleanupKey?: string
}

export interface MachineE2ELeaseSnapshot {
  readonly owner: Readonly<LeaseOwner>
  readonly scopes: readonly MachineE2ELeaseRecoveryScope[]
  readonly borrowers: readonly {
    readonly pid: number
    readonly token: string
    readonly scopes: readonly string[]
  }[]
}

export async function assertRecoveryNode(file: string, kind: 'directory' | 'file') {
  const stat = await lstat(file)
  if (stat.isSymbolicLink() || (kind === 'directory' ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)) {
    throw new Error('Machine lease recovery refuses redirected or non-regular filesystem entries.')
  }
}

function assertKeys(value: unknown, keys: string[], optionalKeys: string[] = []): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !isDeepStrictEqual(Object.keys(value).filter(key => !optionalKeys.includes(key)).sort(), keys.toSorted())) {
    throw new Error('Machine lease recovery found unknown or missing record fields.')
  }
}

async function readRecord(file: string, keys: string[], optionalKeys: string[] = []) {
  await assertRecoveryNode(file, 'file')
  const value: unknown = JSON.parse(await readFile(file, 'utf8'))
  assertKeys(value, keys, optionalKeys)
  return value
}

async function entries(directory: string) {
  return assertRecoveryNode(directory, 'directory').then(() => readdir(directory)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  })
}

/** 仅在机器租约短临界区内读取，拒绝无法还原归属链的登记。 */
export async function readMachineSnapshot(directory: string): Promise<MachineE2ELeaseSnapshot> {
  await assertRecoveryNode(directory, 'directory').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
    throw new Error('Machine lease recovery requires an existing, verifiable owner.')
  })
  const rootEntries = await readdir(directory)
  if (!rootEntries.includes('owner.json') || rootEntries.some(entry => !['owner.json', 'scopes', 'borrowers'].includes(entry))) {
    throw new Error('Machine lease recovery found an unknown or missing lease root entry.')
  }
  const rawOwner = await readRecord(path.join(directory, 'owner.json'), ['pid', 'token'])
  const { pid, token } = parseMachineCredential(JSON.stringify(rawOwner))
  const owner = { pid, token }
  const scopes: MachineE2ELeaseRecoveryScope[] = []
  for (const file of (await entries(path.join(directory, 'scopes'))).sort()) {
    const id = file.endsWith('.json') ? file.slice(0, -5) : ''
    const raw = await readRecord(path.join(directory, 'scopes', file), ['owner', 'ancestors', 'sealed', 'completed'], ['cleanupKey'])
    assertKeys(raw.owner, ['pid', 'token'])
    scopes.push({ id, ...await readScope(directory, id) })
  }
  const byId = new Map(scopes.map(scope => [scope.id, scope]))
  for (const scope of scopes) {
    if (!isDeepStrictEqual(scope.owner, owner) || scope.ancestors.includes(scope.id)
      || scope.ancestors.some((id, index) => !isDeepStrictEqual(byId.get(id)?.ancestors, scope.ancestors.slice(0, index)))
      || (!scope.completed && scope.ancestors.some(id => byId.get(id)?.completed))
      || (scope.completed && !scope.sealed)) {
      throw new Error('Machine lease recovery found an unverifiable scope ownership chain.')
    }
  }
  const borrowers = []
  for (const file of (await entries(path.join(directory, 'borrowers'))).sort()) {
    const raw = await readRecord(path.join(directory, 'borrowers', file), ['pid', 'token', 'scopes'])
    const borrower = parseMachineCredential(JSON.stringify(raw))
    if (file !== `${borrower.token}.json`
      || borrower.scopes.some((id, index) => !isDeepStrictEqual(byId.get(id)?.ancestors, borrower.scopes.slice(0, index)))) {
      throw new Error('Machine lease recovery found an unverifiable borrower ownership chain.')
    }
    borrowers.push(borrower)
  }
  return { owner, scopes, borrowers }
}

export function assertSnapshotStopped(snapshot: MachineE2ELeaseSnapshot, requireOwnerStopped: boolean) {
  if ((requireOwnerStopped && isProcessAlive(snapshot.owner.pid))
    || snapshot.borrowers.some(borrower => isProcessAlive(borrower.pid))) {
    throw new Error('Runtime busy: machine lease recovery requires the owner and registered borrowers to have stopped.')
  }
  if (snapshot.scopes.some(scope => !scope.sealed)) {
    throw new Error('Machine lease recovery requires every command scope to be explicitly sealed.')
  }
}

export async function assertMachineSnapshot(directory: string, expected: MachineE2ELeaseSnapshot) {
  const actual = await readMachineSnapshot(directory)
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error('Machine lease recovery snapshot changed; refusing cleanup of unexpected ownership, scopes, or borrowers.')
  }
  assertSnapshotStopped(actual, false)
}

export function recoveryScopeCopy(scope: MachineE2ELeaseRecoveryScope): MachineE2ELeaseRecoveryScope {
  return Object.freeze({ ...scope, owner: Object.freeze({ ...scope.owner }), ancestors: Object.freeze([...scope.ancestors]) })
}
