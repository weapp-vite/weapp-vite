import type { NativeLayoutAssets } from '../../../vue/transform/pageLayout'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeLayoutAssetResolver } from './nativeLayoutAssets'

const discover = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<NativeLayoutAssets>>())
vi.mock('../../../vue/transform/pageLayout', () => ({ collectNativeLayoutAssets: discover }))

const base = path.resolve('fixtures/layouts/default/index')

describe('entry-local native layout discovery', () => {
  beforeEach(() => {
    discover.mockReset()
    discover.mockResolvedValue({ template: `${base}.wxml` })
  })

  it('shares concurrent and completed discovery only within one resolver', async () => {
    const deferred = Promise.withResolvers<NativeLayoutAssets>()
    discover.mockReturnValueOnce(deferred.promise)
    const resolve = createNativeLayoutAssetResolver()
    const first = resolve(base, 'weapp')
    const second = resolve(base, 'weapp')
    expect(discover).toHaveBeenCalledExactlyOnceWith(base, 'weapp')
    deferred.resolve({ style: `${base}.scss` })
    await expect(Promise.all([first, second, resolve(base, 'weapp')])).resolves.toEqual([
      { style: `${base}.scss` },
      { style: `${base}.scss` },
      { style: `${base}.scss` },
    ])
    await expect(resolve(base, 'weapp')).resolves.toEqual({ style: `${base}.scss` })
    expect(discover).toHaveBeenCalledTimes(1)
    const nextLoad = createNativeLayoutAssetResolver()
    await expect(nextLoad(base, 'weapp')).resolves.toEqual({ template: `${base}.wxml` })
    expect(discover).toHaveBeenCalledTimes(2)
  })

  it('keeps platforms and distinct physical path spellings separate', async () => {
    const resolve = createNativeLayoutAssetResolver()
    for (const [file, platform] of [
      [base, undefined],
      [base, 'weapp'],
      [base, 'alipay'],
      [`${base}Upper`, 'weapp'],
      [`${base}upper`, 'weapp'],
    ] as const) {
      await resolve(file, platform)
    }
    expect(discover.mock.calls).toEqual([
      [base, undefined],
      [base, 'weapp'],
      [base, 'alipay'],
      [`${base}Upper`, 'weapp'],
      [`${base}upper`, 'weapp'],
    ])
  })

  it('preserves discovery errors and permits retry without retaining rejected results', async () => {
    const failure = new Error('discovery failed')
    discover.mockRejectedValueOnce(failure)
    const resolve = createNativeLayoutAssetResolver()
    await expect(resolve(base, 'weapp')).rejects.toBe(failure)
    await expect(resolve(base, 'weapp')).resolves.toEqual({ template: `${base}.wxml` })
    expect(discover).toHaveBeenCalledTimes(2)
  })
})
