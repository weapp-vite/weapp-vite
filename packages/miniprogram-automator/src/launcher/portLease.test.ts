/**
 * @file 自动化端口租约测试。
 */
import fs from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireAutomatorPortLease } from './portLease'

const activeLeases: Array<{ release: () => Promise<void> }> = []

afterEach(async () => {
  await Promise.all(activeLeases.splice(0).map(lease => lease.release()))
})

describe('automator port lease', () => {
  it('allocates different ports for concurrent default launches', async () => {
    const leases = await Promise.all([
      acquireAutomatorPortLease(),
      acquireAutomatorPortLease(),
    ])
    activeLeases.push(...leases)

    expect(leases[0].port).not.toBe(leases[1].port)
  })

  it('rejects an explicitly leased port', async () => {
    const lease = await acquireAutomatorPortLease(29_420)
    activeLeases.push(lease)

    await expect(acquireAutomatorPortLease(29_420)).rejects.toThrow('Port 29420 is in use')
  })

  it('removes lock files after release', async () => {
    const lease = await acquireAutomatorPortLease()
    expect(lease.path).toBeTruthy()

    await lease.release()

    await expect(fs.access(lease.path!)).rejects.toThrow()
  })

  it('retains a failed release for retry and shares concurrent cleanup', async () => {
    const lease = await acquireAutomatorPortLease()
    activeLeases.push(lease)
    const error = new Error('lock removal denied')
    const remove = vi.spyOn(fs, 'rm').mockRejectedValueOnce(error)
    try {
      const first = lease.release()
      expect(lease.release()).toBe(first)
      await expect(first).rejects.toBe(error)
      await expect(fs.access(lease.path!)).resolves.toBeUndefined()
      await lease.release()
      await expect(fs.access(lease.path!)).rejects.toThrow()
    }
    finally {
      remove.mockRestore()
    }
  })
})
