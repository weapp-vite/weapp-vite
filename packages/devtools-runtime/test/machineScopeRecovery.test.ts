import type { ChildProcess } from 'node:child_process'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { acquireMachineE2ELease, withMachineE2ELease } from '../src/lease/machine'
import { readMachineE2ELeaseSnapshot } from '../src/lease/machineRecovery'
import { killDescendantFixture, stoppedDescendantFixture } from './helpers/stoppedDescendants'

const roots: string[] = []
const children: ChildProcess[] = []
afterEach(async () => {
  await Promise.all(children.splice(0).map(killDescendantFixture))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('recovers explicitly bound descendants after a real nested runner is killed, then releases the root', async () => {
  const { stateDirectory, lease, scope, child, message, resource } = await stoppedDescendantFixture(roots, children)
  const sibling = await lease.createChildScope({ cleanupKey: 'unrelated-owned-resource' })
  const siblingLease = await acquireMachineE2ELease({ stateDirectory, env: sibling.environment })
  await killDescendantFixture(child)
  // 最小原故障：外层 seal 因死亡进程遗留未完成后代失败，无法进入父资源清理。
  await expect(scope.seal()).rejects.toThrow('descendant scope has unfinished cleanup')
  await expect(lease.release()).rejects.toThrow('child operation')
  const order: string[] = []
  const parentOptions = { stateDirectory, env: { ...lease.environment } }
  await withMachineE2ELease(async () => {
    await scope.recoverStoppedDescendants(async (descendant) => {
      expect(descendant.sealed).toBe(true)
      expect(descendant.completed).toBe(false)
      expect(Object.isFrozen(descendant)).toBe(true)
      expect(Object.isFrozen(descendant.owner)).toBe(true)
      expect(Object.isFrozen(descendant.ancestors)).toBe(true)
      expect([message.childKey, message.grandchildKey]).toContain(descendant.cleanupKey)
      order.push(descendant.cleanupKey)
      await withMachineE2ELease(async (cleanupLease) => {
        expect(cleanupLease.borrowed).toBe(true)
        expect(await readFile(path.join(descendant.cleanupKey, 'owned-resource'), 'utf8')).toBe('registered')
        await rm(path.join(descendant.cleanupKey, 'owned-resource'))
      }, parentOptions)
    })
  }, parentOptions)
  expect(order).toEqual([message.grandchildKey, message.childKey])
  const current = await readMachineE2ELeaseSnapshot({ stateDirectory })
  expect(current.scopes.find(item => item.cleanupKey === resource)).toMatchObject({ sealed: true, completed: false })
  expect(current.scopes.find(item => item.cleanupKey === 'unrelated-owned-resource')).toMatchObject({ sealed: false, completed: false })
  expect(current.borrowers.some(item => item.pid === child.pid)).toBe(true)
  const again = vi.fn(async () => {})
  await scope.recoverStoppedDescendants(again)
  expect(again).not.toHaveBeenCalled()
  await scope.seal()
  await scope.complete()
  await siblingLease.release()
  await sibling.seal()
  await sibling.complete()
  await lease.release()
  const successor = await acquireMachineE2ELease({ stateDirectory, env: {} })
  await successor.release()
})

it('seals late registration but refuses cleanup while a real descendant borrower remains alive', async () => {
  const { stateDirectory, scope, child, message } = await stoppedDescendantFixture(roots, children)
  const cleanup = vi.fn(async () => {})
  await expect(scope.recoverStoppedDescendants(cleanup)).rejects.toThrow('child is still running')
  expect(cleanup).not.toHaveBeenCalled()
  await expect(acquireMachineE2ELease({ stateDirectory, env: message.grandchildEnvironment })).rejects.toThrow('scope is sealed')
  await killDescendantFixture(child)
  await scope.recoverStoppedDescendants(cleanup)
  expect(cleanup).toHaveBeenCalledTimes(2)
})

it('preserves callback failure and retries only unfinished descendants in deepest-first order', async () => {
  const { stateDirectory, scope, child, message } = await stoppedDescendantFixture(roots, children)
  await killDescendantFixture(child)
  const original = new Error('journal cleanup failed')
  const visited: string[] = []
  await expect(scope.recoverStoppedDescendants(async (descendant) => {
    visited.push(descendant.cleanupKey)
    if (descendant.cleanupKey === message.childKey) {
      throw original
    }
  })).rejects.toBe(original)
  expect(visited).toEqual([message.grandchildKey, message.childKey])
  const snapshot = await readMachineE2ELeaseSnapshot({ stateDirectory })
  expect(snapshot.scopes.find(item => item.cleanupKey === message.grandchildKey)?.completed).toBe(true)
  expect(snapshot.scopes.find(item => item.cleanupKey === message.childKey)?.completed).toBe(false)
  const retry: string[] = []
  await scope.recoverStoppedDescendants(async descendant => void retry.push(descendant.cleanupKey))
  expect(retry).toEqual([message.childKey])
})

it('refuses legacy descendants without cleanup bindings', async () => {
  const { stateDirectory, scope, child } = await stoppedDescendantFixture(roots, children, true)
  await killDescendantFixture(child)
  const cleanup = vi.fn(async () => {})
  await expect(scope.recoverStoppedDescendants(cleanup)).rejects.toThrow('explicit cleanupKey')
  expect(cleanup).not.toHaveBeenCalled()
  expect((await readMachineE2ELeaseSnapshot({ stateDirectory })).scopes.every(item => !item.completed)).toBe(true)
})

it('rejects changed bindings after callback and preserves unfinished evidence', async () => {
  const { stateDirectory, scope, child } = await stoppedDescendantFixture(roots, children)
  await killDescendantFixture(child)
  await expect(scope.recoverStoppedDescendants(async (descendant) => {
    const file = path.join(stateDirectory, 'machine-e2e', 'scopes', `${descendant.id}.json`)
    const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    await writeFile(file, JSON.stringify({ ...value, cleanupKey: 'changed-resource' }))
  })).rejects.toThrow('snapshot changed')
  expect((await readMachineE2ELeaseSnapshot({ stateDirectory })).scopes.every(item => !item.completed)).toBe(true)
})

it('refuses unknown borrower scope records without invoking cleanup', async () => {
  const { stateDirectory, scope, child } = await stoppedDescendantFixture(roots, children)
  await killDescendantFixture(child)
  const snapshot = await readMachineE2ELeaseSnapshot({ stateDirectory })
  const borrower = snapshot.borrowers[0]!
  await writeFile(path.join(stateDirectory, 'machine-e2e', 'borrowers', `${borrower.token}.json`), JSON.stringify({ pid: borrower.pid, token: borrower.token }))
  const cleanup = vi.fn(async () => {})
  await expect(scope.recoverStoppedDescendants(cleanup)).rejects.toThrow('unknown or missing record fields')
  expect(cleanup).not.toHaveBeenCalled()
})

it('coalesces concurrent cleanup calls for the same scope', async () => {
  const { scope, child } = await stoppedDescendantFixture(roots, children)
  await killDescendantFixture(child)
  const entered = Promise.withResolvers<void>()
  const proceed = Promise.withResolvers<void>()
  const cleanup = vi.fn(async () => {
    entered.resolve()
    await proceed.promise
  })
  const first = scope.recoverStoppedDescendants(cleanup)
  await entered.promise
  const duplicate = vi.fn(async () => {})
  const second = scope.recoverStoppedDescendants(duplicate)
  proceed.resolve()
  await Promise.all([first, second])
  expect(cleanup).toHaveBeenCalledTimes(2)
  expect(duplicate).not.toHaveBeenCalled()
})

it('refuses overlapping parent and retained descendant recovery capabilities', async () => {
  const { stateDirectory, scope, child } = await stoppedDescendantFixture(roots, children)
  const borrower = await acquireMachineE2ELease({ stateDirectory, env: scope.environment })
  const retained = await borrower.createChildScope({ cleanupKey: 'retained-child' })
  const nested = await acquireMachineE2ELease({ stateDirectory, env: retained.environment })
  await nested.createChildScope({ cleanupKey: 'retained-grandchild' })
  await nested.release()
  await borrower.release()
  await killDescendantFixture(child)
  const entered = Promise.withResolvers<void>()
  const proceed = Promise.withResolvers<void>()
  const first = scope.recoverStoppedDescendants(async () => {
    entered.resolve()
    await proceed.promise
  })
  await entered.promise
  const overlapping = vi.fn(async () => {})
  try {
    await expect(retained.recoverStoppedDescendants(overlapping)).rejects.toThrow('overlapping machine descendant recovery')
    expect(overlapping).not.toHaveBeenCalled()
  }
  finally {
    proceed.resolve()
    await first
  }
})
