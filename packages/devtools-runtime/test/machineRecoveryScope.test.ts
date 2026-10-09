import type { MachineE2ELeaseRecoveryScope } from '../src/lease/machineRecovery'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { mutateLease } from '../src/lease/directory'
import { withMachineE2ELease } from '../src/lease/machine'
import { assertMachineE2ELeaseRecoveryScope, readMachineE2ELeaseSnapshot, recoverMachineE2ELease } from '../src/lease/machineRecovery'
import { machineRecoveryFixture } from './helpers/machineRecovery'

const roots: string[] = []
const inactive = 'active explicit recovery callback and its original scope'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(nested = false) {
  const result = await machineRecoveryFixture(roots, nested)
  for (const { id, ...scope } of result.expected.scopes) {
    await writeFile(path.join(result.directory, 'scopes', `${id}.json`), JSON.stringify({ ...scope, cleanupKey: `journal-${id}` }))
  }
  return { ...result, expected: await readMachineE2ELeaseSnapshot(result.options) }
}

it('authorizes only the current immutable scope and includes previously completed descendants in its snapshot', async () => {
  const { options, expected, child, parent } = await fixture(true)
  const visited: string[] = []
  let previous: MachineE2ELeaseRecoveryScope | undefined
  await recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      await Promise.resolve()
      await expect(assertMachineE2ELeaseRecoveryScope(scope)).resolves.toBeUndefined()
      expect(scope.cleanupKey).toBe(`journal-${scope.id}`)
      expect(Object.isFrozen(scope)).toBe(true)
      expect(Object.isFrozen(scope.owner)).toBe(true)
      expect(Object.isFrozen(scope.ancestors)).toBe(true)
      await expect(assertMachineE2ELeaseRecoveryScope({ ...scope })).rejects.toThrow(inactive)
      await expect(assertMachineE2ELeaseRecoveryScope(expected.scopes.find(item => item.id === scope.id)!)).rejects.toThrow(inactive)
      if (previous) {
        await expect(assertMachineE2ELeaseRecoveryScope(previous)).rejects.toThrow(inactive)
        const snapshot = await readMachineE2ELeaseSnapshot(options)
        expect(snapshot.scopes.find(item => item.id === child)?.completed).toBe(true)
      }
      previous = scope
      visited.push(scope.id)
    },
  })
  expect(visited).toEqual([child, parent])
  await expect(assertMachineE2ELeaseRecoveryScope(previous!)).rejects.toThrow(inactive)
})

it('does not infer recovery authority from an ordinary machine lease', async () => {
  const { expected } = await fixture()
  const stateDirectory = await mkdtemp(path.join(tmpdir(), 'ordinary-machine-lease-'))
  roots.push(stateDirectory)
  await withMachineE2ELease(async () => {
    await expect(assertMachineE2ELeaseRecoveryScope(expected.scopes[0]!)).rejects.toThrow(inactive)
  }, { stateDirectory, env: {} })
})

it('rejects the issued scope outside its async context even while its callback is active', async () => {
  const { options, expected } = await fixture()
  const entered = Promise.withResolvers<MachineE2ELeaseRecoveryScope>()
  const proceed = Promise.withResolvers<void>()
  const recovery = recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      entered.resolve(scope)
      await proceed.promise
      await assertMachineE2ELeaseRecoveryScope(scope)
    },
  })
  const scope = await entered.promise
  try {
    await expect(assertMachineE2ELeaseRecoveryScope(scope)).rejects.toThrow(inactive)
  }
  finally {
    proceed.resolve()
    await recovery
  }
})

it.each([false, true])('invalidates a detached async continuation after callback failure=%s', async (fails) => {
  const { options, expected } = await fixture()
  const proceed = Promise.withResolvers<void>()
  const original = new Error('recovery callback failed')
  let detached: Promise<unknown> | undefined
  const recovery = recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      await assertMachineE2ELeaseRecoveryScope(scope)
      detached = proceed.promise.then(() => assertMachineE2ELeaseRecoveryScope(scope)).catch(error => error)
      if (fails) {
        throw original
      }
    },
  })
  if (fails) {
    await expect(recovery).rejects.toBe(original)
  }
  else {
    await recovery
  }
  proceed.resolve()
  expect(await detached).toEqual(expect.objectContaining({ message: expect.stringContaining(inactive) }))
})

it('rejects an in-flight assertion when its callback expires while it waits for the mutation lock', async () => {
  const { directory, options, expected } = await fixture()
  const unlock = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  const original = new Error('callback exited while assertion waits')
  let lock: Promise<void> | undefined
  let assertion: Promise<unknown> | undefined
  try {
    await expect(recoverMachineE2ELease({
      ...options,
      expected,
      recoverScope: async (scope) => {
        lock = mutateLease(directory, async () => {
          entered.resolve()
          await unlock.promise
        })
        await entered.promise
        assertion = assertMachineE2ELeaseRecoveryScope(scope).catch(error => error)
        throw original
      },
    })).rejects.toBe(original)
  }
  finally {
    unlock.resolve()
    await lock
  }
  expect(await assertion).toEqual(expect.objectContaining({ message: expect.stringContaining(inactive) }))
})

it.each(['owner', 'cleanupKey', 'completed-descendant', 'extra-scope', 'borrower'] as const)('rejects %s drift in the complete adopted snapshot', async (changed) => {
  const { directory, options, expected, parent, child, borrower } = await fixture(true)
  await expect(recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      await assertMachineE2ELeaseRecoveryScope(scope)
      if (scope.id !== parent) {
        return
      }
      const snapshot = await readMachineE2ELeaseSnapshot(options)
      if (changed === 'owner') {
        const owner = { ...snapshot.owner, token: randomUUID() }
        await writeFile(path.join(directory, 'owner.json'), JSON.stringify(owner))
        for (const { id, ...item } of snapshot.scopes) {
          await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify({ ...item, owner }))
        }
      }
      else if (changed === 'cleanupKey') {
        const { id, ...item } = scope
        await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify({ ...item, cleanupKey: 'another-journal' }))
      }
      else if (changed === 'completed-descendant') {
        const { id, ...item } = snapshot.scopes.find(item => item.id === child)!
        await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify({ ...item, completed: false }))
      }
      else if (changed === 'extra-scope') {
        const { id: _id, ...item } = scope
        await writeFile(path.join(directory, 'scopes', `${randomUUID()}.json`), JSON.stringify(item))
      }
      else {
        await writeFile(path.join(directory, 'borrowers', `${borrower.token}.json`), JSON.stringify({ ...borrower, scopes: [] }))
      }
      await assertMachineE2ELeaseRecoveryScope(scope)
    },
  })).rejects.toThrow('snapshot changed')
  expect((await readMachineE2ELeaseSnapshot(options)).scopes.find(scope => scope.id === parent)?.completed).toBe(false)
})
