import type { MachineE2ELease } from '../src/lease/machine'
import type { MachineE2ELeaseSnapshot } from '../src/lease/machineRecovery'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { acquireMachineE2ELease, withMachineE2ELease } from '../src/lease/machine'
import { readMachineE2ELeaseSnapshot, recoverMachineE2ELease } from '../src/lease/machineRecovery'
import { machineRecoveryFixture } from './helpers/machineRecovery'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function fixture(nested = false) {
  return machineRecoveryFixture(roots, nested)
}

it('recovers exact sealed scopes deepest first, supports nested normal leases and retains its audit', async () => {
  const { directory, options, expected, parent, child } = await fixture(true)
  const visited: string[] = []
  options.env.WEAPP_VITE_E2E_MACHINE_LEASE = 'prior-environment'
  await expect(acquireMachineE2ELease({ ...options, env: {} })).rejects.toThrow('unfinished cleanup')
  const result = await recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      visited.push(scope.id)
      expect(scope.owner.pid).toBe(process.pid)
      expect(scope.owner.token).not.toBe(expected.owner.token)
      expect(Object.isFrozen(scope)).toBe(true)
      expect(Object.isFrozen(scope.owner)).toBe(true)
      expect(Object.isFrozen(scope.ancestors)).toBe(true)
      await withMachineE2ELease(async (borrowed) => {
        expect(borrowed.borrowed).toBe(true)
        const credential: unknown = JSON.parse(borrowed.environment.WEAPP_VITE_E2E_MACHINE_LEASE!)
        expect(credential).toEqual(scope.owner)
        await withMachineE2ELease(async second => expect(second.borrowed).toBe(true), options)
      }, options)
      const current = await readMachineE2ELeaseSnapshot(options)
      if (scope.id === parent) {
        expect(current.scopes.find(item => item.id === child)?.completed).toBe(true)
      }
    },
  })
  expect(visited).toEqual([child, parent])
  expect(result.recoveredScopes).toEqual(visited)
  expect(options.env.WEAPP_VITE_E2E_MACHINE_LEASE).toBe('prior-environment')
  await expect(readdir(directory)).rejects.toMatchObject({ code: 'ENOENT' })
  const events = (await readFile(result.auditFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
  expect(events[0]).toMatchObject({ event: 'adopting', expected })
  expect(events.map(event => event.event)).toEqual(['adopting', 'adopted', 'scope-completed', 'scope-completed', 'releasing'])
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope: async () => {} })).rejects.toThrow('existing, verifiable owner')
  const fresh = await acquireMachineE2ELease({ ...options, env: {} })
  await fresh.release()
})

it('preserves a failed callback error and retries only after its recovery owner exits', async () => {
  const { root, directory, options, expected } = await fixture()
  const childFile = fileURLToPath(new URL('./fixtures/machineLeaseRecoveryChild.ts', import.meta.url))
  const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), childFile, root], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  let errors = ''
  child.stdout.on('data', chunk => output += String(chunk))
  child.stderr.on('data', chunk => errors += String(chunk))
  const [code] = await once(child, 'exit')
  expect({ code, errors }).toEqual({ code: 0, errors: '' })
  expect(JSON.parse(output)).toEqual({ originalErrorPreserved: true })
  const failed = await readMachineE2ELeaseSnapshot(options)
  expect(failed.owner.pid).toBe(child.pid)
  expect(failed.owner.token).not.toBe(expected.owner.token)
  expect(failed.scopes[0]?.completed).toBe(false)
  await expect(acquireMachineE2ELease(options)).rejects.toThrow('unfinished cleanup')
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope: async () => {} })).rejects.toThrow('snapshot changed')
  const result = await recoverMachineE2ELease({ ...options, expected: failed, recoverScope: async () => {} })
  await expect(readdir(directory)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readdir(path.dirname(result.auditFile))).toHaveLength(2)
})

it.each(['owner', 'borrower'] as const)('refuses an active %s before adopting or calling cleanup', async (active) => {
  const { directory, options, expected, borrower, parent } = await fixture()
  if (active === 'owner') {
    const owner = { ...expected.owner, pid: process.pid }
    await writeFile(path.join(directory, 'owner.json'), JSON.stringify(owner))
    await writeFile(path.join(directory, 'scopes', `${parent}.json`), JSON.stringify({ owner, ancestors: [], sealed: true, completed: false }))
  }
  else {
    await writeFile(path.join(directory, 'borrowers', `${borrower.token}.json`), JSON.stringify({ ...borrower, pid: process.pid }))
  }
  const current = await readMachineE2ELeaseSnapshot(options)
  const recoverScope = vi.fn(async () => {})
  await expect(recoverMachineE2ELease({ ...options, expected: current, recoverScope })).rejects.toThrow('to have stopped')
  expect(recoverScope).not.toHaveBeenCalled()
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(current)
})

it('rejects stale snapshots without mutating the current owner or evidence', async () => {
  const { directory, options, expected, parent } = await fixture()
  const file = path.join(directory, 'scopes', `${parent}.json`)
  await writeFile(file, JSON.stringify({ owner: expected.owner, ancestors: [], sealed: true, completed: true }))
  const current = await readMachineE2ELeaseSnapshot(options)
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope: async () => {} })).rejects.toThrow('snapshot changed')
  expect(await readMachineE2ELeaseSnapshot(options)).toEqual(current)
})

it('refuses unexpected scopes created by cleanup instead of completing or releasing its inventory', async () => {
  const { options, expected, parent } = await fixture()
  await expect(recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async () => {
      await withMachineE2ELease(async lease => void await lease.createChildScope(), options)
    },
  })).rejects.toThrow('snapshot changed')
  const after = await readMachineE2ELeaseSnapshot(options)
  expect(after.scopes).toHaveLength(2)
  expect(after.scopes.find(scope => scope.id === parent)?.completed).toBe(false)
  await expect(recoverMachineE2ELease({ ...options, expected: after, recoverScope: async () => {} })).rejects.toThrow()
})

it('retains an unfinished scope when cleanup leaves an active borrower', async () => {
  const { options, expected } = await fixture()
  let borrowed: MachineE2ELease | undefined
  try {
    await expect(recoverMachineE2ELease({
      ...options,
      expected,
      recoverScope: async () => { borrowed = await acquireMachineE2ELease(options) },
    })).rejects.toThrow('snapshot changed')
    expect((await readMachineE2ELeaseSnapshot(options)).scopes[0]?.completed).toBe(false)
  }
  finally {
    await borrowed?.release()
  }
})

it('refuses unsealed scopes and preserves an unknown mutation guard', async () => {
  const { directory, options, expected, parent } = await fixture()
  await writeFile(path.join(directory, 'scopes', `${parent}.json`), JSON.stringify({ owner: expected.owner, ancestors: [], sealed: false, completed: false }))
  const current = await readMachineE2ELeaseSnapshot(options)
  await expect(recoverMachineE2ELease({ ...options, expected: current, recoverScope: async () => {} })).rejects.toThrow('explicitly sealed')
  await mkdir(`${directory}.recovery`)
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope: async () => {} })).rejects.toThrow('recovery is in progress')
  expect(await readdir(`${directory}.recovery`)).toEqual([])
})

it('preserves the original callback exception, restores environment and blocks same-process retry', async () => {
  const { options, expected } = await fixture()
  const original = new Error('journal is still unresolved')
  await expect(recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async () => { throw original },
  })).rejects.toBe(original)
  expect(options.env.WEAPP_VITE_E2E_MACHINE_LEASE).toBeUndefined()
  const current: MachineE2ELeaseSnapshot = await readMachineE2ELeaseSnapshot(options)
  expect(current.owner.pid).toBe(process.pid)
  expect(current.scopes[0]?.completed).toBe(false)
  await expect(recoverMachineE2ELease({ ...options, expected: current, recoverScope: async () => {} })).rejects.toThrow('to have stopped')
})

it('serializes competing recoveries without running cleanup twice', async () => {
  const { options, expected } = await fixture()
  const entered = Promise.withResolvers<void>()
  const proceed = Promise.withResolvers<void>()
  const recoverScope = vi.fn(async () => {
    entered.resolve()
    await proceed.promise
  })
  const first = recoverMachineE2ELease({ ...options, expected, recoverScope })
  await entered.promise
  try {
    await expect(recoverMachineE2ELease({ ...options, expected, recoverScope })).rejects.toThrow('snapshot changed')
    expect(recoverScope).toHaveBeenCalledTimes(1)
  }
  finally {
    proceed.resolve()
  }
  await expect(first).resolves.toMatchObject({ recoveredScopes: [expected.scopes[0]!.id] })
})

it('preserves an optional cleanup binding through orphan adoption and its audit', async () => {
  const { directory, options, expected, parent } = await fixture()
  const cleanupKey = 'bound-journal-resource'
  await writeFile(path.join(directory, 'scopes', `${parent}.json`), JSON.stringify({ owner: expected.owner, ancestors: [], sealed: true, completed: false, cleanupKey }))
  const bound = await readMachineE2ELeaseSnapshot(options)
  expect(bound.scopes[0]?.cleanupKey).toBe(cleanupKey)
  const result = await recoverMachineE2ELease({
    ...options,
    expected: bound,
    recoverScope: async scope => expect(scope.cleanupKey).toBe(cleanupKey),
  })
  const first: unknown = JSON.parse((await readFile(result.auditFile, 'utf8')).split('\n')[0]!)
  expect(first).toMatchObject({ expected: { scopes: [{ cleanupKey }] } })
})
