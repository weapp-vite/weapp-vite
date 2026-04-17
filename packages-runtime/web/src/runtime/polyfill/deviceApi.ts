import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
} from './async'
import {
  readBatteryInfoSnapshot,
  readBatteryInfoSyncSnapshot,
  vibrateDevice,
} from './device'

export function vibrateShortBridge(options?: any) {
  try {
    vibrateDevice(options?.type)
    return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'vibrateShort:ok' }))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callMiniProgramAsyncFailure(options, `vibrateShort:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function getBatteryInfoSyncBridge() {
  return readBatteryInfoSyncSnapshot()
}

export async function getBatteryInfoBridge(options?: any) {
  try {
    const batteryInfo = await readBatteryInfoSnapshot()
    return callMiniProgramAsyncSuccess(options, {
      errMsg: 'getBatteryInfo:ok',
      ...batteryInfo,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callMiniProgramAsyncFailure(options, `getBatteryInfo:fail ${message}`)
    return Promise.reject(failure)
  }
}
