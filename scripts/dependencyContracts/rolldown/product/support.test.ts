import { describe, expect, it, vi } from 'vitest'
import { UnconfirmedContractCleanupError } from '../helpers.mjs'
import { withBundle } from './support.mjs'

describe('public Rolldown bundle ownership', () => {
  it('closes the acquired bundle and returns the observation only after closure', async () => {
    const bundle = { closed: false, close: vi.fn(async () => {
      bundle.closed = true
    }) }
    const rolldown = vi.fn(async () => bundle)
    expect(await withBundle(rolldown, { input: 'entry.js' }, async current => ({ same: current === bundle }))).toEqual({ same: true })
    expect(rolldown).toHaveBeenCalledExactlyOnceWith({ input: 'entry.js' })
    expect(bundle.close).toHaveBeenCalledTimes(1)
    expect(bundle.closed).toBe(true)
  })

  it.each([undefined, null, false, 0, ''])('retains the original %j failure after confirmed cleanup', async (original) => {
    const bundle = { closed: true, close: vi.fn(async () => {}) }
    const result = await withBundle(async () => bundle, {}, async () => {
      throw original
    }).then(() => ({ status: 'fulfilled' }), error => ({ status: 'rejected', error }))
    expect(result).toEqual({ status: 'rejected', error: original })
    expect(bundle.close).toHaveBeenCalledTimes(1)
  })

  it('marks a rejected native close as unconfirmed and retains the original assertion', async () => {
    const original = new Error('Product assertion failed')
    const cleanup = new Error('Native close failed')
    const bundle = { closed: false, close: vi.fn(async () => {
      throw cleanup
    }) }
    const result = withBundle(async () => bundle, {}, async () => {
      throw original
    })
    await expect(result).rejects.toBeInstanceOf(UnconfirmedContractCleanupError)
    await expect(result).rejects.toMatchObject({ errors: [original, cleanup], cause: original })
  })

  it('does not mistake a fulfilled close without a closed handle for resource completion', async () => {
    const bundle = { closed: false, close: vi.fn(async () => {}) }
    const result = withBundle(async () => bundle, {}, async () => 42)
    await expect(result).rejects.toBeInstanceOf(UnconfirmedContractCleanupError)
    await expect(result).rejects.toMatchObject({ errors: [expect.objectContaining({ message: expect.stringContaining('must confirm') })] })
  })

  it('does not acquire or close a made-up handle when initialization rejects', async () => {
    const original = new Error('Native initialization failed')
    const inspect = vi.fn()
    await expect(withBundle(async () => {
      throw original
    }, {}, inspect)).rejects.toBe(original)
    expect(inspect).not.toHaveBeenCalled()
  })
})
