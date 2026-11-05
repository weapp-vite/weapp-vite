/* eslint-disable e18e/ban-dependencies -- 所有权测试只使用 execa 的子进程类型。 */
import type { Subprocess } from 'execa'
import type { InventoryCommandOwnership } from './ownership'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnedCommandShutdownError } from '../../scripts/ownedE2ECommand/shutdown'
import { withInventoryCommandScope } from './ownership'

const mocks = vi.hoisted(() => ({ scope: vi.fn(), seal: vi.fn(), complete: vi.fn(), identity: vi.fn() }))
vi.mock('../../../packages/devtools-runtime/src/lease/machine', () => ({
  withMachineE2ELease: async (run: (lease: { createChildScope: typeof mocks.scope }) => Promise<unknown>) => await run({ createChildScope: mocks.scope }),
}))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/processIdentity', () => ({ readManagedProcessIdentity: mocks.identity }))

const records: string[] = []
const request = { rootDirectory: path.resolve('inventory'), nonce: 'owned-request', entry: path.resolve('scanner-entry.ts') }
const child = { pid: 24680 } as unknown as Subprocess

beforeEach(() => {
  vi.resetAllMocks()
  mocks.seal.mockResolvedValue(undefined)
  mocks.complete.mockResolvedValue(undefined)
  mocks.identity.mockImplementation(async (pid: number) => ({ pid, executable: 'owned-node', started: 'observed-generation' }))
  mocks.scope.mockImplementation(async ({ cleanupKey }: { cleanupKey: string }) => {
    records.push(cleanupKey)
    return { environment: { TEST_SCOPE: 'owned-scanner' }, seal: mocks.seal, complete: mocks.complete }
  })
})
afterEach(async () => {
  await Promise.all(records.splice(0).map(file => fs.rm(path.dirname(file), { recursive: true, force: true })))
})

async function readRecord() {
  return JSON.parse(await fs.readFile(records.at(-1)!, 'utf8')) as Record<string, unknown>
}

describe('inventory scanner machine command scope', () => {
  it('binds actual child identity before completing the scope and removes a successful record', async () => {
    let ownership!: InventoryCommandOwnership
    await withInventoryCommandScope(request, async (current) => {
      ownership = current
      await current.recordChild(child)
      expect(await readRecord()).toMatchObject({ ...request, child: { pid: child.pid, identity: { started: 'observed-generation' } } })
      expect(mocks.complete).not.toHaveBeenCalled()
      current.confirmStopped()
    })
    expect(ownership.environment).toEqual({ TEST_SCOPE: 'owned-scanner' })
    expect(mocks.seal).toHaveBeenCalledOnce()
    expect(mocks.complete).toHaveBeenCalledOnce()
    expect(mocks.seal.mock.invocationCallOrder[0]).toBeLessThan(mocks.complete.mock.invocationCallOrder[0]!)
    await expect(fs.stat(records[0]!)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps an unconfirmed command scope incomplete and preserves its original failure', async () => {
    const failure = new OwnedCommandShutdownError('owned group cannot be inspected')
    await expect(withInventoryCommandScope(request, async (ownership) => {
      await ownership.recordChild(child)
      throw failure
    })).rejects.toBe(failure)
    expect(mocks.seal).toHaveBeenCalledOnce()
    expect(mocks.complete).not.toHaveBeenCalled()
    expect(await readRecord()).not.toHaveProperty('stoppedAt')
  })

  it('preserves both unconfirmed shutdown and a failed scope seal', async () => {
    const shutdown = new OwnedCommandShutdownError('scanner group remains unknown')
    const seal = new Error('scanner borrower is still live')
    mocks.seal.mockRejectedValue(seal)
    const failure = await withInventoryCommandScope(request, async (ownership) => {
      await ownership.recordChild(child)
      throw shutdown
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(OwnedCommandShutdownError)
    expect((failure as Error).cause).toMatchObject({ errors: [shutdown, seal] })
    expect(mocks.complete).not.toHaveBeenCalled()
    expect(await readRecord()).toHaveProperty('child')
  })

  it('releases a confirmed stopped scope while retaining failed scan evidence', async () => {
    const failure = new Error('historical project is unreleased')
    await expect(withInventoryCommandScope(request, async (ownership) => {
      await ownership.recordChild(child)
      ownership.confirmStopped()
      throw failure
    })).rejects.toBe(failure)
    expect(mocks.complete).toHaveBeenCalledOnce()
    expect(await readRecord()).toMatchObject({ failure: failure.message, stoppedAt: expect.any(String) })
  })

  it('does not pretend identity inspection failure supplied a process birth', async () => {
    mocks.identity.mockRejectedValue(new Error('OS identity unavailable'))
    await expect(withInventoryCommandScope(request, async (ownership) => {
      await ownership.recordChild(child)
      expect(await readRecord()).toMatchObject({ child: { pid: child.pid, identityError: 'OS identity unavailable' } })
      expect((await readRecord()).child).not.toHaveProperty('identity')
      ownership.confirmStopped()
    })).resolves.toBeUndefined()
  })
})
