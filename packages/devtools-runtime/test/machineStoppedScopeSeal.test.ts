import type { MachineE2ELeaseSnapshot } from '../src/lease/machineRecovery'
import { mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { acquireMachineE2ELease } from '../src/lease/machine'
import { readMachineE2ELeaseSnapshot, recoverMachineE2ELease } from '../src/lease/machineRecovery'
import { sealStoppedMachineE2ELeaseScopes } from '../src/lease/machineStoppedScopeSeal'
import { machineRecoveryFixture } from './helpers/machineRecovery'

const faults = vi.hoisted(() => ({
  renameCount: 0,
  failRename: 0,
  uuids: [] as string[],
  failAppend: false,
  failInitialAudit: false,
  alivePids: new Set<number>(),
  afterStaging: undefined as (() => void) | undefined,
}))
vi.mock('../src/lease/directory', async (original) => {
  const actual = await original<typeof import('../src/lease/directory')>()
  return { ...actual, isProcessAlive: (pid: number) => faults.alivePids.has(pid) || actual.isProcessAlive(pid) }
})
vi.mock('node:crypto', async (original) => {
  const actual = await original<typeof import('node:crypto')>()
  return { ...actual, randomUUID: () => faults.uuids.shift() ?? actual.randomUUID() }
})
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return {
    ...actual,
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      const file = String(args[0])
      if (faults.failInitialAudit && file.endsWith('.jsonl')) {
        throw new Error('initial audit persistence failed')
      }
      await actual.writeFile(...args)
      if (path.basename(path.dirname(file)) === 'machine-e2e-seals' && file.endsWith('.json')) {
        faults.afterStaging?.()
      }
    },
    appendFile: async (...args: Parameters<typeof actual.appendFile>) => {
      if (faults.failAppend) {
        throw new Error('audit persistence failed')
      }
      return actual.appendFile(...args)
    },
    rename: async (...args: Parameters<typeof actual.rename>) => {
      if (++faults.renameCount === faults.failRename) {
        throw new Error('scope persistence failed')
      }
      return actual.rename(...args)
    },
  }
})

const roots: string[] = []
afterEach(async () => {
  faults.renameCount = 0
  faults.failRename = 0
  faults.uuids = []
  faults.failAppend = false
  faults.failInitialAudit = false
  faults.alivePids.clear()
  faults.afterStaging = undefined
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(nested = false) {
  const result = await machineRecoveryFixture(roots, nested)
  for (const scope of result.expected.scopes.filter(scope => !scope.completed)) {
    const { id, ...record } = scope
    await writeFile(path.join(result.directory, 'scopes', `${id}.json`), JSON.stringify({
      ...record,
      sealed: false,
      cleanupKey: `resource-journal:${id}`,
    }))
  }
  const expected = await readMachineE2ELeaseSnapshot(result.options)
  const cleanupKeys = Object.fromEntries(expected.scopes.filter(scope => !scope.completed).map(scope => [scope.id, scope.cleanupKey!]))
  return { ...result, expected, cleanupKeys }
}

async function writeSnapshotScope(directory: string, snapshot: MachineE2ELeaseSnapshot, id: string, extra: Record<string, unknown>) {
  const { id: _, ...record } = snapshot.scopes.find(scope => scope.id === id)!
  await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify({ ...record, ...extra }))
}

it('seals exact stopped registrations without adopting, completing, deleting or granting cleanup permission', async () => {
  const { directory, options, expected, cleanupKeys, parent, child } = await fixture(true)
  const recoverScope = vi.fn(async () => {})
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope })).rejects.toThrow('explicitly sealed')
  expect(recoverScope).not.toHaveBeenCalled()
  const result = await sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })
  expect(result.snapshot.owner).toEqual(expected.owner)
  expect(result.snapshot.borrowers).toEqual(expected.borrowers)
  expect(result.snapshot.scopes).toEqual(expected.scopes.map(scope => ({ ...scope, sealed: true })))
  expect(result.sealedScopes.toSorted()).toEqual([parent, child].toSorted())
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(result.snapshot)
  await expect(acquireMachineE2ELease(options)).rejects.toThrow('unfinished cleanup')
  const events = (await readFile(result.auditFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
  expect(events[0]).toMatchObject({ event: 'sealing-stopped', expected, cleanupKeys })
  expect(events.slice(1).map(event => event.event)).toEqual(['scope-sealed', 'scope-sealed'])
  const recovery = await recoverMachineE2ELease({ ...options, expected: result.snapshot, recoverScope })
  expect(recovery.recoveredScopes).toEqual([child, parent])
  await expect(readdir(directory)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(result.auditFile, 'utf8')).toContain('sealing-stopped')
})

it.each(['owner', 'borrower'] as const)('refuses an active %s and preserves all records before audit', async (active) => {
  const { directory, options, expected, parent, borrower, cleanupKeys, root } = await fixture()
  if (active === 'owner') {
    const owner = { ...expected.owner, pid: process.pid }
    await writeFile(path.join(directory, 'owner.json'), JSON.stringify(owner))
    await writeSnapshotScope(directory, expected, parent, { owner })
  }
  else {
    await writeFile(path.join(directory, 'borrowers', `${borrower.token}.json`), JSON.stringify({ ...borrower, pid: process.pid }))
  }
  const current = await readMachineE2ELeaseSnapshot(options)
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected: current, cleanupKeys })).rejects.toThrow('to have stopped')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(current)
  await expect(readdir(path.join(root, 'machine-e2e-seals'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each(['missing', 'different', 'extra'] as const)('requires exact %s cleanup bindings without mutation', async (change) => {
  const { options, expected, cleanupKeys, parent } = await fixture()
  if (change === 'missing') {
    delete cleanupKeys[parent]
  }
  else if (change === 'different') {
    cleanupKeys[parent] = 'another-project-journal'
  }
  else {
    cleanupKeys['another-scope'] = 'another-project-journal'
  }
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('exact cleanupKey')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(expected)
})

it('rejects unfinished scopes without an original cleanup binding', async () => {
  const { directory, options, expected, parent, cleanupKeys } = await fixture()
  await writeSnapshotScope(directory, expected, parent, { cleanupKey: undefined })
  const current = await readMachineE2ELeaseSnapshot(options)
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected: current, cleanupKeys })).rejects.toThrow('exact cleanupKey')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(current)
})

it('rejects a stale owner snapshot and never changes another registration', async () => {
  const { directory, options, expected, cleanupKeys, parent } = await fixture()
  await writeSnapshotScope(directory, expected, parent, { cleanupKey: 'new-journal' })
  const current = await readMachineE2ELeaseSnapshot(options)
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('snapshot changed')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(current)
})

it('preserves an unknown mutation lock instead of treating it as stale', async () => {
  const { directory, options, expected, cleanupKeys } = await fixture()
  await mkdir(`${directory}.recovery`)
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('recovery is in progress')
  expect(await readdir(`${directory}.recovery`)).toEqual([])
})

it('refuses redirected audit storage before changing any command scope', async () => {
  const { root, options, expected, cleanupKeys } = await fixture()
  const target = path.join(root, 'other-records')
  await mkdir(target)
  await symlink(target, path.join(root, 'machine-e2e-seals'), process.platform === 'win32' ? 'junction' : 'dir')
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('redirected')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(expected)
  expect(await readdir(target)).toEqual([])
})

it('retains partial sealing evidence, retries from a fresh exact snapshot and keeps all cleanup incomplete', async () => {
  const { directory, options, expected, cleanupKeys } = await fixture(true)
  faults.failRename = 2
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('scope persistence failed')
  const partial = await readMachineE2ELeaseSnapshot(options)
  expect(partial.owner).toEqual(expected.owner)
  expect(partial.scopes.filter(scope => !scope.completed && scope.sealed)).toHaveLength(1)
  expect(partial.scopes.filter(scope => !scope.completed && !scope.sealed)).toHaveLength(1)
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('snapshot changed')
  faults.failRename = 0
  const result = await sealStoppedMachineE2ELeaseScopes({ ...options, expected: partial, cleanupKeys })
  expect(result.sealedScopes).toHaveLength(1)
  expect(result.snapshot.scopes.filter(scope => !scope.completed)).toHaveLength(2)
  await expect(acquireMachineE2ELease(options)).rejects.toThrow('unfinished cleanup')
  const auditEntries = await readdir(path.dirname(result.auditFile))
  expect(auditEntries.filter(file => file.endsWith('.jsonl'))).toHaveLength(2)
  expect(auditEntries.filter(file => file.endsWith('.json'))).toHaveLength(1)
  await expect(readdir(`${directory}.recovery`)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('preserves a pre-existing staging record when exclusive creation refuses a collision', async () => {
  const { root, options, expected, cleanupKeys } = await fixture()
  const auditDirectory = path.join(root, 'machine-e2e-seals')
  await mkdir(auditDirectory)
  const stagingId = 'existing-staging-record'
  const file = path.join(auditDirectory, `${stagingId}.json`)
  await writeFile(file, 'another operation owns this evidence')
  faults.uuids = ['new-sealing-audit', stagingId]
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toMatchObject({ code: 'EEXIST' })
  expect(await readFile(file, 'utf8')).toBe('another operation owns this evidence')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(expected)
})

it('preserves an append failure after sealing without claiming resource completion', async () => {
  const { options, expected, cleanupKeys } = await fixture()
  faults.failAppend = true
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('audit persistence failed')
  const current = await readMachineE2ELeaseSnapshot(options)
  expect(current.owner).toEqual(expected.owner)
  expect(current.scopes[0]).toMatchObject({ sealed: true, completed: false })
  await expect(acquireMachineE2ELease(options)).rejects.toThrow('unfinished cleanup')
  faults.failAppend = false
  const recoverScope = vi.fn(async () => {
    throw new Error('journal unresolved')
  })
  await expect(recoverMachineE2ELease({ ...options, expected: current, recoverScope })).rejects.toThrow('journal unresolved')
  expect(recoverScope).toHaveBeenCalledTimes(1)
  expect((await readMachineE2ELeaseSnapshot(options)).scopes[0]?.completed).toBe(false)
})

it('requires the original snapshot audit to persist before sealing', async () => {
  const { root, options, expected, cleanupKeys } = await fixture()
  faults.failInitialAudit = true
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('initial audit persistence failed')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(expected)
  expect(await readdir(path.join(root, 'machine-e2e-seals'))).toEqual([])
})

it('rechecks stopped processes after staging and retains evidence when a PID becomes alive', async () => {
  const { root, options, expected, cleanupKeys } = await fixture()
  faults.afterStaging = () => faults.alivePids.add(expected.owner.pid)
  await expect(sealStoppedMachineE2ELeaseScopes({ ...options, expected, cleanupKeys })).rejects.toThrow('to have stopped')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(expected)
  const files = await readdir(path.join(root, 'machine-e2e-seals'))
  expect(files.filter(file => file.endsWith('.jsonl'))).toHaveLength(1)
  expect(files.filter(file => file.endsWith('.json'))).toHaveLength(1)
})
