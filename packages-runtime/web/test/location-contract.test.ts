import {
  WEAPP_VITE_WEB_CHOOSE_ADDRESS_KEY,
  WEAPP_VITE_WEB_CHOOSE_LOCATION_KEY,
  WEAPP_VITE_WEB_FUZZY_LOCATION_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeFuzzyCoordinate,
  normalizeGeoNumber,
  parseChooseAddressPromptInput,
  parseChooseLocationPromptInput,
  readCurrentLocation,
  readPresetChooseAddress,
  readPresetChooseLocation,
  readPresetFuzzyLocation,
} from '../src/runtime/polyfill/location'

const presetKeys = [
  WEAPP_VITE_WEB_CHOOSE_ADDRESS_KEY,
  WEAPP_VITE_WEB_CHOOSE_LOCATION_KEY,
  WEAPP_VITE_WEB_FUZZY_LOCATION_KEY,
]

describe('location adapter contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key of presetKeys) {
      Reflect.deleteProperty(globalThis, key)
    }
  })

  it('normalizes coordinate numbers and unavailable geolocation hosts', () => {
    expect(normalizeGeoNumber(12.5, -1)).toBe(12.5)
    expect(normalizeGeoNumber(Number.NaN, -1)).toBe(-1)
    expect(normalizeGeoNumber('12', -1)).toBe(-1)
    expect(normalizeFuzzyCoordinate(12.345)).toBe(12.35)

    vi.stubGlobal('navigator', undefined)
    expect(() => readCurrentLocation()).toThrow('geolocation is unavailable')
    vi.stubGlobal('navigator', { geolocation: {} })
    expect(() => readCurrentLocation()).toThrow('geolocation is unavailable')
  })

  it('normalizes missing coordinates and forwards accuracy options', async () => {
    const getCurrentPosition = vi.fn((success: (position: any) => void) => {
      success({ coords: undefined })
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await expect(readCurrentLocation()).resolves.toEqual({
      accuracy: 0,
      altitude: 0,
      horizontalAccuracy: 0,
      latitude: 0,
      longitude: 0,
      speed: -1,
      verticalAccuracy: 0,
    })
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: false,
      timeout: undefined,
    })

    getCurrentPosition.mockImplementationOnce((success: (position: any) => void) => {
      success({
        coords: {
          accuracy: 8,
          altitude: null,
          altitudeAccuracy: null,
          latitude: 30,
          longitude: 120,
          speed: null,
        },
      })
    })
    await readCurrentLocation({ altitude: true, highAccuracyExpireTime: 500 })
    expect(getCurrentPosition.mock.calls[1]?.[2]).toEqual({
      enableHighAccuracy: true,
      timeout: 500,
    })
  })

  it('rejects geolocation failures with host and default messages', async () => {
    const getCurrentPosition = vi.fn((_success: unknown, failure: (error?: any) => void) => {
      failure(undefined)
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    await expect(readCurrentLocation()).rejects.toThrow('unknown error')

    getCurrentPosition.mockImplementationOnce((_success: unknown, failure: (error?: any) => void) => {
      failure({ message: 'permission denied' })
    })
    await expect(readCurrentLocation({ isHighAccuracy: true, highAccuracyExpireTime: 0 })).rejects.toThrow('permission denied')
  })

  it('validates and normalizes fuzzy location presets', () => {
    expect(readPresetFuzzyLocation()).toBeNull()
    Object.assign(globalThis, { [WEAPP_VITE_WEB_FUZZY_LOCATION_KEY]: 'invalid' })
    expect(readPresetFuzzyLocation()).toBeNull()
    Object.assign(globalThis, { [WEAPP_VITE_WEB_FUZZY_LOCATION_KEY]: { latitude: 'invalid', longitude: 120 } })
    expect(readPresetFuzzyLocation()).toBeNull()
    Object.assign(globalThis, { [WEAPP_VITE_WEB_FUZZY_LOCATION_KEY]: { latitude: 30, longitude: 'invalid' } })
    expect(readPresetFuzzyLocation()).toBeNull()
    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_FUZZY_LOCATION_KEY]: { accuracy: 'invalid', latitude: 30.126, longitude: 120.124 },
    })
    expect(readPresetFuzzyLocation()).toEqual({ accuracy: 1000, latitude: 30.13, longitude: 120.12 })
  })

  it('validates choose-location and choose-address preset fields', () => {
    expect(readPresetChooseLocation()).toBeNull()
    Object.assign(globalThis, { [WEAPP_VITE_WEB_CHOOSE_LOCATION_KEY]: 1 })
    expect(readPresetChooseLocation()).toBeNull()
    Object.assign(globalThis, { [WEAPP_VITE_WEB_CHOOSE_LOCATION_KEY]: { latitude: 30, longitude: 'invalid' } })
    expect(readPresetChooseLocation()).toBeNull()
    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_CHOOSE_LOCATION_KEY]: { address: 1, latitude: 30, longitude: 120, name: null },
    })
    expect(readPresetChooseLocation()).toEqual({ address: '', latitude: 30, longitude: 120, name: '' })

    expect(readPresetChooseAddress()).toBeNull()
    Object.assign(globalThis, { [WEAPP_VITE_WEB_CHOOSE_ADDRESS_KEY]: 'invalid' })
    expect(readPresetChooseAddress()).toBeNull()
    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_CHOOSE_ADDRESS_KEY]: {
        cityName: null,
        countyName: null,
        detailInfo: null,
        nationalCode: null,
        postalCode: null,
        provinceName: null,
        telNumber: null,
        userName: null,
      },
    })
    expect(readPresetChooseAddress()).toEqual({
      cityName: '',
      countyName: '',
      detailInfo: '',
      nationalCode: '',
      postalCode: '',
      provinceName: '',
      telNumber: '',
      userName: '',
    })
    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_CHOOSE_ADDRESS_KEY]: {
        nationalCode: 'CN',
        postalCode: '310000',
      },
    })
    expect(readPresetChooseAddress()).toMatchObject({
      nationalCode: 'CN',
      postalCode: '310000',
    })
  })

  it('parses prompt values and rejects missing or invalid fields', () => {
    expect(parseChooseAddressPromptInput('Province,City,County')).toBeNull()
    expect(parseChooseAddressPromptInput('Province，City，County，Street')).toEqual({
      cityName: 'City',
      countyName: 'County',
      detailInfo: 'Street',
      nationalCode: '',
      postalCode: '',
      provinceName: 'Province',
      telNumber: '',
      userName: '',
    })
    expect(parseChooseLocationPromptInput('invalid,120')).toBeNull()
    expect(parseChooseLocationPromptInput('30,invalid')).toBeNull()
    expect(parseChooseLocationPromptInput('30,120')).toEqual({ latitude: 30, longitude: 120 })
  })
})
