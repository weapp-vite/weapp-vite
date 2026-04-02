import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  normalizeFuzzyCoordinate,
  normalizeGeoNumber,
  parseChooseAddressPromptInput,
  parseChooseLocationPromptInput,
  readCurrentLocation,
  readPresetChooseAddress,
  readPresetChooseLocation,
  readPresetFuzzyLocation,
} from './location'
import { openTargetInNewWindow } from './mediaActions'
import { getGlobalDialogHandlers } from './ui'

export function makePhoneCallBridge(options?: any) {
  const phoneNumber = typeof options?.phoneNumber === 'string' ? options.phoneNumber.trim() : ''
  if (!phoneNumber) {
    const failure = callWxAsyncFailure(options, 'makePhoneCall:fail invalid phoneNumber')
    return Promise.reject(failure)
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(`tel:${encodeURIComponent(phoneNumber)}`, '_self')
    }
    catch {
      // ignore browser restrictions and keep API-level success semantics
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'makePhoneCall:ok' }))
}

export function chooseAddressBridge(options?: any) {
  const preset = readPresetChooseAddress()
  if (preset) {
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseAddress:ok',
      ...preset,
    }))
  }
  const { prompt } = getGlobalDialogHandlers()
  if (typeof prompt === 'function') {
    const input = prompt('请输入地址（格式：省,市,区,详细地址,姓名,电话）', '')
    if (input == null) {
      const failure = callWxAsyncFailure(options, 'chooseAddress:fail cancel')
      return Promise.reject(failure)
    }
    const parsed = parseChooseAddressPromptInput(input)
    if (!parsed) {
      const failure = callWxAsyncFailure(options, 'chooseAddress:fail invalid input')
      return Promise.reject(failure)
    }
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseAddress:ok',
      ...parsed,
    }))
  }
  const failure = callWxAsyncFailure(options, 'chooseAddress:fail address picker is unavailable')
  return Promise.reject(failure)
}

export function chooseLocationBridge(options?: any) {
  const preset = readPresetChooseLocation()
  if (preset) {
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseLocation:ok',
      ...preset,
    }))
  }
  const { prompt } = getGlobalDialogHandlers()
  if (typeof prompt === 'function') {
    const input = prompt('请输入坐标（格式：latitude,longitude）', '')
    if (input == null) {
      const failure = callWxAsyncFailure(options, 'chooseLocation:fail cancel')
      return Promise.reject(failure)
    }
    const parsed = parseChooseLocationPromptInput(input)
    if (!parsed) {
      const failure = callWxAsyncFailure(options, 'chooseLocation:fail invalid latitude/longitude')
      return Promise.reject(failure)
    }
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseLocation:ok',
      name: '',
      address: '',
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    }))
  }
  const failure = callWxAsyncFailure(options, 'chooseLocation:fail location picker is unavailable')
  return Promise.reject(failure)
}

export function openLocationBridge(options?: any) {
  const latitude = options?.latitude
  const longitude = options?.longitude
  if (typeof latitude !== 'number' || Number.isNaN(latitude) || typeof longitude !== 'number' || Number.isNaN(longitude)) {
    const failure = callWxAsyncFailure(options, 'openLocation:fail invalid latitude/longitude')
    return Promise.reject(failure)
  }
  const query = `${latitude},${longitude}`
  const target = `https://maps.google.com/?q=${encodeURIComponent(query)}`
  openTargetInNewWindow(target)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'openLocation:ok' }))
}

export function getLocationBridge(options?: any) {
  try {
    return readCurrentLocation(options)
      .then(location => callWxAsyncSuccess(options, {
        errMsg: 'getLocation:ok',
        ...location,
      }))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        const failure = callWxAsyncFailure(options, `getLocation:fail ${message}`)
        return Promise.reject(failure)
      })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getLocation:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function getFuzzyLocationBridge(options?: any) {
  const preset = readPresetFuzzyLocation()
  if (preset) {
    return callWxAsyncSuccess(options, {
      errMsg: 'getFuzzyLocation:ok',
      ...preset,
    })
  }
  try {
    const location = await getLocationBridge()
    return callWxAsyncSuccess(options, {
      errMsg: 'getFuzzyLocation:ok',
      latitude: normalizeFuzzyCoordinate(location.latitude),
      longitude: normalizeFuzzyCoordinate(location.longitude),
      accuracy: Math.max(1000, normalizeGeoNumber(location.accuracy, 1000)),
    })
  }
  catch (error) {
    const message = typeof (error as { errMsg?: unknown })?.errMsg === 'string'
      ? (error as { errMsg: string }).errMsg
      : error instanceof Error
        ? error.message
        : String(error)
    const failure = callWxAsyncFailure(options, `getFuzzyLocation:fail ${message}`)
    return Promise.reject(failure)
  }
}
