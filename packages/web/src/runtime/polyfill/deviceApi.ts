import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  readBatteryInfoSnapshot,
  readBatteryInfoSyncSnapshot,
  vibrateDevice,
} from './device'

export function vibrateShortBridge(options?: any) {
  try {
    vibrateDevice(options?.type)
    return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'vibrateShort:ok' }))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `vibrateShort:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function getBatteryInfoSyncBridge() {
  return readBatteryInfoSyncSnapshot()
}

export async function getBatteryInfoBridge(options?: any) {
  try {
    const batteryInfo = await readBatteryInfoSnapshot()
    return callWxAsyncSuccess(options, {
      errMsg: 'getBatteryInfo:ok',
      ...batteryInfo,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getBatteryInfo:fail ${message}`)
    return Promise.reject(failure)
  }
}
