/**
 * @file 百度智能小程序自动化 TypeScript 运行时。
 */
import type { SmartappConnectType, SmartappDevicesResult, SmartappDeviceType, SmartappLaunchOptions } from './types'
import Connection from '../Connection'
import MiniProgram from '../MiniProgram'
import SmartappDevice from './Device'
import { file } from './file'
import { image } from './image'
import { log } from './log'
import { time } from './time'

const DEFAULT_CONNECT_TYPE: SmartappConnectType = 'usb'

function resolveDeviceType(deviceType: string | undefined): SmartappDeviceType {
  switch (deviceType) {
    case 'android':
    case 'iOS':
    case 'web':
    case 'devtools':
    case 'simulator':
      return deviceType
    default:
      return 'simulator'
  }
}

function resolveConnectType(connectType: string | undefined): SmartappConnectType {
  switch (connectType) {
    case 'usb':
    case 'wifi':
    case 'newBaiduCloud':
    case 'mtpaas':
      return connectType
    default:
      return DEFAULT_CONNECT_TYPE
  }
}

async function connectMiniProgram(wsEndpoint: string) {
  const connection = await Connection.create(wsEndpoint)
  return new MiniProgram(connection)
}

export async function launch(options: SmartappLaunchOptions & { wsEndpoint?: string } = {}) {
  const deviceType = resolveDeviceType(options.deviceType)
  const connectType = resolveConnectType(options.connectType)
  const deviceId = options.deviceId || `${deviceType}-${connectType}`

  if (deviceType === 'simulator' || deviceType === 'devtools') {
    const miniProgram = options.wsEndpoint
      ? await connectMiniProgram(options.wsEndpoint)
      : undefined
    return new SmartappDevice('devtools', connectType, deviceId, {
      miniProgram,
    })
  }

  return new SmartappDevice(deviceType, connectType, deviceId)
}

export async function connect(options: Record<string, unknown>) {
  if (typeof options.wsEndpoint !== 'string') {
    throw new TypeError('wsEndpoint is required for smartapp runtime connection.')
  }
  const miniProgram = await connectMiniProgram(options.wsEndpoint)
  return new SmartappDevice('devtools', DEFAULT_CONNECT_TYPE, 'devtools-usb', {
    miniProgram,
  })
}

export async function devices(deviceType: string, _connectType: string = DEFAULT_CONNECT_TYPE): Promise<SmartappDevicesResult> {
  const resolvedDeviceType = resolveDeviceType(deviceType)
  if (resolvedDeviceType === 'simulator' || resolvedDeviceType === 'devtools') {
    return {
      devtools: { status: 0 },
    }
  }
  return {}
}

export const SmartappAutomator = {
  connect,
  devices,
  file,
  image,
  launch,
  log,
  time,
}

export { file, image, log, time }
export default SmartappAutomator
