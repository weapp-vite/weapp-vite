import { describe, expect, it, vi } from 'vitest'
import { createCloudBridge } from '../src/runtime/polyfill/cloud'
import { $off, $on, $once } from '../src/runtime/polyfill/eventBus'
import { getLogManagerBridge } from '../src/runtime/polyfill/platformApi'
import { setupRpx } from '../src/runtime/rpx'

describe('runtime miscellaneous branch matrix', () => {
  it('normalizes cloud init, function names, and default data', async () => {
    const success = vi.fn((_options, result) => result)
    const failure = vi.fn((_options, errMsg) => ({ errMsg }))
    const cloud = createCloudBridge(success, failure)
    cloud.init({ env: 1 as any, traceUser: true })
    await expect(cloud.callFunction({ name: 1 as any })).rejects.toMatchObject({
      errMsg: 'cloud.callFunction:fail invalid function name',
    })
    await expect(cloud.callFunction({ name: 'demo' })).resolves.toMatchObject({
      result: { name: 'demo', data: {}, env: '', traceUser: true },
    })
  })

  it('reuses event listener sets and accepts log level zero', () => {
    const first = vi.fn()
    const once = vi.fn()
    $on('shared', first)
    $once('shared', once)
    $off('shared')
    expect(getLogManagerBridge({ level: 0 })).toBeDefined()
  })

  it('applies default rpx options when a document exists without window', () => {
    const setProperty = vi.fn()
    vi.stubGlobal('document', {
      documentElement: { style: { setProperty } },
      querySelector: () => null,
    })
    vi.stubGlobal('window', undefined)
    setupRpx()
    expect(setProperty).toHaveBeenCalledWith('--rpx', '0px')
    vi.unstubAllGlobals()
  })
})
