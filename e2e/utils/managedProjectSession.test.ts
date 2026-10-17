import { describe, expect, it, vi } from 'vitest'
import { attachManagedProjectSession } from './managedProjectSession'

describe('managed project session', () => {
  it('keeps every disconnect caller pending until the socket close is confirmed', async () => {
    const barrier = Promise.withResolvers<void>()
    const disconnect = vi.fn(() => barrier.promise)
    const closeOwner = vi.fn(async () => {})
    const session = attachManagedProjectSession({ close: vi.fn(), disconnect }, closeOwner)
    const first = session.disconnect()
    const second = session.disconnect()
    expect(second).toBe(first)
    const closing = session.close()
    await Promise.resolve()
    expect(closeOwner).not.toHaveBeenCalled()
    barrier.resolve()
    await Promise.all([first, second, closing])
    expect(disconnect).toHaveBeenCalledOnce()
    expect(closeOwner).toHaveBeenCalledOnce()
  })

  it('rechecks an unconfirmed disconnect before allowing subsequent cleanup to complete', async () => {
    const failure = new Error('socket close unconfirmed')
    const disconnect = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined)
    const closeOwner = vi.fn(async () => {})
    const session = attachManagedProjectSession({ close: vi.fn(), disconnect }, closeOwner)
    await expect(session.disconnect()).rejects.toBe(failure)
    expect(closeOwner).not.toHaveBeenCalled()
    await session.close()
    await session.disconnect()
    expect(disconnect).toHaveBeenCalledTimes(2)
    expect(closeOwner).toHaveBeenCalledOnce()
  })

  it('closes the owned window after disconnect and shares concurrent cleanup', async () => {
    const rawClose = vi.fn()
    const disconnect = vi.fn()
    const closeOwner = vi.fn(async () => {})
    const session = attachManagedProjectSession({ close: rawClose, disconnect }, closeOwner)
    session.disconnect()
    await Promise.all([session.close(), session.close()])
    await session.close()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(closeOwner).toHaveBeenCalledOnce()
    expect(rawClose).not.toHaveBeenCalled()
  })

  it('retries failed window cleanup without reusing a closed connection', async () => {
    const disconnect = vi.fn()
    const closeOwner = vi.fn().mockRejectedValueOnce(new Error('window remained open')).mockResolvedValue(undefined)
    const session = attachManagedProjectSession({ close: vi.fn(), disconnect }, closeOwner)
    await expect(session.close()).rejects.toThrow('Managed IDE session cleanup failed')
    await session.close()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(closeOwner).toHaveBeenCalledTimes(2)
  })

  it('never sends Tool.close to a borrowed project', async () => {
    const rawClose = vi.fn()
    const releaseBorrowedRecord = vi.fn(async () => {})
    const session = attachManagedProjectSession({ close: rawClose, disconnect: vi.fn() }, releaseBorrowedRecord)
    await session.close()
    expect(releaseBorrowedRecord).toHaveBeenCalledOnce()
    expect(rawClose).not.toHaveBeenCalled()
  })

  it('attempts window cleanup even if disconnect fails', async () => {
    const closeOwner = vi.fn(async () => {})
    const session = attachManagedProjectSession({ close: vi.fn(), disconnect: vi.fn(() => {
      throw new Error('disconnect failed')
    }) }, closeOwner)
    await expect(session.close()).rejects.toThrow('Managed IDE session cleanup failed')
    expect(closeOwner).toHaveBeenCalledOnce()
  })
})
