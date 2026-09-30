import { describe, expect, it, vi } from 'vitest'
import { cleanupOwnedDevtoolsProcesses, ownDevtoolsCleanup } from './devtoolsProcessOwnership'

describe('DevTools process ownership', () => {
  it('disposes only registered resources, exactly once across close and recovery', async () => {
    const owned = vi.fn(async () => {})
    const foreign = vi.fn(async () => {})
    const dispose = ownDevtoolsCleanup(owned)
    await Promise.all([dispose(), cleanupOwnedDevtoolsProcesses()])
    await cleanupOwnedDevtoolsProcesses()
    expect(owned).toHaveBeenCalledTimes(1)
    expect(foreign).not.toHaveBeenCalled()
  })

  it('cleans remaining resources after one fails and keeps failed ownership for retry', async () => {
    const failed = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValue(undefined)
    const other = vi.fn(async () => {})
    ownDevtoolsCleanup(failed)
    ownDevtoolsCleanup(other)
    await expect(cleanupOwnedDevtoolsProcesses()).rejects.toThrow('Failed to clean owned')
    expect(other).toHaveBeenCalledTimes(1)
    await cleanupOwnedDevtoolsProcesses()
    expect(failed).toHaveBeenCalledTimes(2)
    expect(other).toHaveBeenCalledTimes(1)
  })
})
