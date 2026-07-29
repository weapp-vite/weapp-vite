import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import {
  chooseAddressBridge,
  chooseLocationBridge,
  getFuzzyLocationBridge,
  getLocationBridge,
  makePhoneCallBridge,
  openLocationBridge,
} from '../src/runtime/polyfill/locationApi'

describe('location API orchestration contract', () => {
  afterEach(() => {
    resetWebRuntimeHost()
    vi.unstubAllGlobals()
  })

  it('handles address prompt cancellation, invalid input, and missing capability', async () => {
    setWebRuntimeHost({ dialogs: { prompt: vi.fn(() => null) } })
    await expect(chooseAddressBridge()).rejects.toMatchObject({ errMsg: 'chooseAddress:fail cancel' })
    setWebRuntimeHost({ dialogs: { prompt: vi.fn(() => 'Province,City') } })
    await expect(chooseAddressBridge()).rejects.toMatchObject({ errMsg: 'chooseAddress:fail invalid input' })
    setWebRuntimeHost({ dialogs: {} })
    await expect(chooseAddressBridge()).rejects.toMatchObject({
      errMsg: 'chooseAddress:fail address picker is unavailable',
    })
  })

  it('handles location prompt cancellation, invalid input, and missing capability', async () => {
    setWebRuntimeHost({ dialogs: { prompt: vi.fn(() => null) } })
    await expect(chooseLocationBridge()).rejects.toMatchObject({ errMsg: 'chooseLocation:fail cancel' })
    setWebRuntimeHost({ dialogs: { prompt: vi.fn(() => 'invalid') } })
    await expect(chooseLocationBridge()).rejects.toMatchObject({
      errMsg: 'chooseLocation:fail invalid latitude/longitude',
    })
    setWebRuntimeHost({ dialogs: {} })
    await expect(chooseLocationBridge()).rejects.toMatchObject({
      errMsg: 'chooseLocation:fail location picker is unavailable',
    })
  })

  it('validates phone and map coordinates while tolerating popup errors', async () => {
    await expect(makePhoneCallBridge()).rejects.toMatchObject({ errMsg: 'makePhoneCall:fail invalid phoneNumber' })
    await expect(makePhoneCallBridge({ phoneNumber: 123 })).rejects.toMatchObject({
      errMsg: 'makePhoneCall:fail invalid phoneNumber',
    })
    setWebRuntimeHost({
      open: vi.fn(() => {
        throw new Error('blocked')
      }),
    })
    await expect(makePhoneCallBridge({ phoneNumber: ' 10086 ' })).resolves.toMatchObject({
      errMsg: 'makePhoneCall:ok',
    })

    for (const options of [
      { latitude: '30', longitude: 120 },
      { latitude: Number.NaN, longitude: 120 },
      { latitude: 30, longitude: '120' },
      { latitude: 30, longitude: Number.NaN },
    ]) {
      await expect(openLocationBridge(options)).rejects.toMatchObject({
        errMsg: 'openLocation:fail invalid latitude/longitude',
      })
    }
  })

  it('maps synchronous and asynchronous geolocation failures', async () => {
    vi.stubGlobal('navigator', undefined)
    await expect(getLocationBridge()).rejects.toMatchObject({
      errMsg: 'getLocation:fail geolocation is unavailable',
    })

    const hostFailure = 'host failure'
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn(() => {
          throw hostFailure
        }),
      },
    })
    await expect(getLocationBridge()).rejects.toMatchObject({ errMsg: 'getLocation:fail host failure' })
    await expect(getFuzzyLocationBridge()).rejects.toMatchObject({
      errMsg: 'getFuzzyLocation:fail getLocation:fail host failure',
    })

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_success: unknown, failure: (error: { message: string }) => void) => {
          failure({ message: 'permission denied' })
        }),
      },
    })
    await expect(getLocationBridge()).rejects.toMatchObject({
      errMsg: 'getLocation:fail permission denied',
    })
  })
})
