import type { MachineE2EChildScope, MachineE2ELease } from '../src/lease/machine'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'
import { acquireMachineE2ELease } from '../src/lease/machine'

const roots: string[] = []
const leases: MachineE2ELease[] = []
const scopes: MachineE2EChildScope[] = []

afterEach(async () => {
  const ownedLeases = leases.splice(0).reverse()
  for (const lease of ownedLeases.filter(lease => lease.borrowed)) {
    await lease.release()
  }
  for (const scope of scopes.splice(0).reverse()) {
    await scope.seal()
    await scope.complete()
  }
  for (const lease of ownedLeases.filter(lease => !lease.borrowed)) {
    await lease.release()
  }
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function acquire(root: string, env: NodeJS.ProcessEnv = {}) {
  const lease = await acquireMachineE2ELease({ stateDirectory: root, env })
  leases.push(lease)
  const create = lease.createChildScope
  lease.createChildScope = async () => {
    const scope = await create()
    scopes.push(scope)
    return scope
  }
  return lease
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'machine-scope-'))
  roots.push(root)
  return { root, owner: await acquire(root) }
}

it('seals nested descendants before parent cleanup and permits existing borrowers to release', async () => {
  const { root, owner } = await fixture()
  const parent = await owner.createChildScope()
  const child = await acquire(root, parent.environment)
  const nested = await child.createChildScope()
  const grandchild = await acquire(root, nested.environment)
  await child.release()
  await expect(parent.seal()).rejects.toThrow('child is still running')
  await expect(acquire(root, nested.environment)).rejects.toThrow('scope is sealed')
  await expect(grandchild.createChildScope()).rejects.toThrow('scope is sealed')
  await grandchild.release()
  await nested.seal()
  await nested.complete()
  await parent.seal()
  await parent.seal()
})

it('keeps sibling scopes independent and rejects late registration after a successful seal', async () => {
  const { root, owner } = await fixture()
  const first = await owner.createChildScope()
  const second = await owner.createChildScope()
  const sibling = await acquire(root, second.environment)
  await first.seal()
  await expect(acquire(root, first.environment)).rejects.toThrow('scope is sealed')
  await expect(second.seal()).rejects.toThrow('child is still running')
  await sibling.release()
  await second.seal()
})

it('serializes sealing against registration without allowing both to succeed', async () => {
  const { root, owner } = await fixture()
  const scope = await owner.createChildScope()
  const [sealed, borrowed] = await Promise.allSettled([scope.seal(), acquire(root, scope.environment)])
  expect(sealed.status === 'fulfilled' && borrowed.status === 'fulfilled').toBe(false)
  if (borrowed.status === 'fulfilled') {
    await borrowed.value.release()
  }
  await scope.seal()
  await expect(acquire(root, scope.environment)).rejects.toThrow('scope is sealed')
})

it('rejects missing, forged, reordered and truncated scope chains', async () => {
  const { root, owner } = await fixture()
  const first = await owner.createChildScope()
  const child = await acquire(root, first.environment)
  const nested = await child.createChildScope()
  const credential = JSON.parse(nested.environment.WEAPP_VITE_E2E_MACHINE_LEASE!) as { pid: number, token: string, scopes: string[] }
  const rootCredential = JSON.parse(owner.environment.WEAPP_VITE_E2E_MACHINE_LEASE!) as { token: string }
  const invalid = [
    { pid: credential.pid, token: credential.token },
    { ...credential, scopes: credential.scopes.slice(1) },
    { ...credential, scopes: credential.scopes.toReversed() },
    { ...credential, scopes: [...credential.scopes, credential.token] },
    { ...credential, token: rootCredential.token },
    { ...credential, token: randomUUID() },
    { ...credential, scopes: [randomUUID(), credential.token] },
  ]
  for (const value of invalid) {
    await expect(acquire(root, { WEAPP_VITE_E2E_MACHINE_LEASE: JSON.stringify(value) })).rejects.toThrow('inherited E2E lease is invalid')
  }
})

it('preserves a sealed boundary when a borrower record has lost its scope chain', async () => {
  const { root, owner } = await fixture()
  const scope = await owner.createChildScope()
  const child = await acquire(root, scope.environment)
  const directory = path.join(root, 'machine-e2e', 'borrowers')
  const file = path.join(directory, (await readdir(directory))[0]!)
  const original = await readFile(file, 'utf8')
  const record = JSON.parse(original) as { pid: number, token: string }
  await writeFile(file, JSON.stringify({ pid: record.pid, token: record.token }))
  try {
    await expect(scope.seal()).rejects.toThrow('no verifiable command scope')
    await expect(acquire(root, scope.environment)).rejects.toThrow('scope is sealed')
  }
  finally {
    await writeFile(file, original)
    await child.release()
  }
})

it('rejects released leases and does not mutate a replacement owner during sealing', async () => {
  const { root, owner } = await fixture()
  const scope = await owner.createChildScope()
  const child = await acquire(root, scope.environment)
  await child.release()
  await expect(child.createChildScope()).rejects.toThrow('inherited E2E lease is invalid')
  const file = path.join(root, 'machine-e2e', 'owner.json')
  const original = await readFile(file, 'utf8')
  const originalOwner = JSON.parse(original) as { pid: number, token: string }
  const replacement = JSON.stringify({ ...originalOwner, token: randomUUID() })
  await writeFile(file, replacement)
  try {
    await expect(scope.seal()).rejects.toThrow('inherited E2E lease is invalid')
    expect(await readFile(file, 'utf8')).toBe(replacement)
  }
  finally {
    await writeFile(file, original)
  }
})

it('holds the machine lease until sealed journal cleanup is explicitly completed', async () => {
  const { root, owner } = await fixture()
  const scope = await owner.createChildScope()
  await scope.seal()
  await expect(owner.release()).rejects.toThrow('unfinished cleanup')
  await expect(acquire(root)).rejects.toThrow('Runtime busy')
  await scope.complete()
  await owner.release()
  const successor = await acquire(root)
  await successor.release()
  scopes.splice(0)
})

it('does not let a parent erase unfinished descendant scopes even after their borrowers exit', async () => {
  const { root, owner } = await fixture()
  const parent = await owner.createChildScope()
  const worker = await acquire(root, parent.environment)
  const orphan = await worker.createChildScope()
  await worker.release()
  await expect(parent.seal()).rejects.toThrow('descendant scope has unfinished cleanup')
  await expect(parent.complete()).rejects.toThrow('descendant scope has unfinished cleanup')
  await expect(owner.release()).rejects.toThrow('unfinished cleanup')
  await orphan.seal()
  await orphan.complete()
  await parent.seal()
  await parent.complete()
  await expect(acquire(root, orphan.environment)).rejects.toThrow('scope is sealed')
  await owner.release()
  scopes.splice(0)
})

it('does not reclaim a dead root while its command cleanup remains unfinished', async () => {
  const { root, owner } = await fixture()
  const scope = await owner.createChildScope()
  await scope.seal()
  const exited = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  await once(exited, 'exit')
  const file = path.join(root, 'machine-e2e', 'owner.json')
  const original = await readFile(file, 'utf8')
  const record = JSON.parse(original) as { pid: number, token: string }
  await writeFile(file, JSON.stringify({ ...record, pid: exited.pid }))
  try {
    await expect(acquire(root)).rejects.toThrow('unfinished cleanup')
  }
  finally {
    await writeFile(file, original)
  }
})
