import type { MachineE2ELeaseRecoveryScope } from '../src/lease/machineRecovery'
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { acquireMachineE2ELease } from '../src/lease/machine'
import { readMachineE2ELeaseSnapshot, recoverMachineE2ELease, withMachineE2ELeaseRecoveryOperation } from '../src/lease/machineRecovery'
import { machineRecoveryFixture } from './helpers/machineRecovery'

const roots: string[] = []
const inactive = 'active explicit recovery callback and its original scope'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('keeps awaited domain operations inside recovery and preserves their result', async () => {
  const { root, directory, options, expected } = await machineRecoveryFixture(roots)
  const destination = path.join(root, 'domain-journal')
  await recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      const result = await withMachineE2ELeaseRecoveryOperation(scope, async () => {
        await writeFile(`${destination}.tmp`, 'verified exit')
        await rename(`${destination}.tmp`, destination)
        expect((await readMachineE2ELeaseSnapshot(options)).scopes[0]?.completed).toBe(false)
        return { recovered: true }
      })
      expect(result).toEqual({ recovered: true })
    },
  })
  expect(await readFile(destination, 'utf8')).toBe('verified exit')
  await expect(readdir(directory)).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each([false, true])('holds the incomplete lease until a detached rename settles after callback failure=%s', async (fails) => {
  const { root, options, expected } = await machineRecoveryFixture(roots)
  const destination = path.join(root, 'domain-journal')
  const ready = Promise.withResolvers<void>()
  const proceed = Promise.withResolvers<void>()
  const original = new Error('callback failed before domain rename')
  let operation: Promise<unknown> | undefined
  let recoverySettled = false
  const recovery = recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      operation = withMachineE2ELeaseRecoveryOperation(scope, async () => {
        await writeFile(`${destination}.tmp`, 'original failure retained')
        ready.resolve()
        await proceed.promise
        await rename(`${destination}.tmp`, destination)
      }).catch(error => error)
      await ready.promise
      if (fails) {
        throw original
      }
    },
  }).then(() => { recoverySettled = true }, (error) => {
    recoverySettled = true
    return error
  })
  await ready.promise
  await setImmediate()
  try {
    expect(recoverySettled).toBe(false)
    const held = await readMachineE2ELeaseSnapshot(options)
    expect(held.scopes[0]?.completed).toBe(false)
    await expect(acquireMachineE2ELease({ ...options, env: {} })).rejects.toThrow('another E2E operation')
  }
  finally {
    proceed.resolve()
  }
  const failure = await recovery
  if (fails) {
    expect(failure).toBe(original)
  }
  else {
    expect(failure).toEqual(expect.objectContaining({ message: expect.stringContaining('unfinished recovery operations') }))
  }
  expect(await operation).toEqual(expect.objectContaining({ message: expect.stringContaining(inactive) }))
  expect(await readFile(destination, 'utf8')).toBe('original failure retained')
  expect((await readMachineE2ELeaseSnapshot(options)).scopes[0]?.completed).toBe(false)
})

it('registers before its initial async snapshot check so immediate callback return cannot escape tracking', async () => {
  const { options, expected } = await machineRecoveryFixture(roots)
  const run = vi.fn(async () => {})
  await expect(recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      void withMachineE2ELeaseRecoveryOperation(scope, run)
    },
  })).rejects.toThrow('unfinished recovery operations')
  expect(run).not.toHaveBeenCalled()
  expect((await readMachineE2ELeaseSnapshot(options)).scopes[0]?.completed).toBe(false)
})

it('rejects forged, former and out-of-context scopes before running a domain operation', async () => {
  const { options, expected } = await machineRecoveryFixture(roots, true)
  const run = vi.fn(async () => {})
  let previous: MachineE2ELeaseRecoveryScope | undefined
  await expect(withMachineE2ELeaseRecoveryOperation(expected.scopes[0]!, run)).rejects.toThrow(inactive)
  await recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      await expect(withMachineE2ELeaseRecoveryOperation({ ...scope }, run)).rejects.toThrow(inactive)
      if (previous) {
        await expect(withMachineE2ELeaseRecoveryOperation(previous, run)).rejects.toThrow(inactive)
      }
      previous = scope
    },
  })
  await expect(withMachineE2ELeaseRecoveryOperation(previous!, run)).rejects.toThrow(inactive)
  expect(run).not.toHaveBeenCalled()
})

it('does not accept a scope issued by another runtime module instance', async () => {
  const { options, expected } = await machineRecoveryFixture(roots)
  vi.resetModules()
  const other = await import('../src/lease/machineRecovery')
  const run = vi.fn(async () => {})
  await recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      await expect(other.withMachineE2ELeaseRecoveryOperation(scope, run)).rejects.toThrow(inactive)
    },
  })
  expect(run).not.toHaveBeenCalled()
})

it('preserves an awaited domain failure and never completes its scope', async () => {
  const { options, expected } = await machineRecoveryFixture(roots)
  const original = new Error('domain operation rejected')
  await expect(recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      await withMachineE2ELeaseRecoveryOperation(scope, async () => {
        throw original
      })
    },
  })).rejects.toBe(original)
  expect((await readMachineE2ELeaseSnapshot(options)).scopes[0]?.completed).toBe(false)
})
