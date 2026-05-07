/**
 * @file 百度智能小程序自动化类型定义。
 */
import type { Buffer } from 'node:buffer'
import type MiniProgram from '../MiniProgram'

export type SmartappDeviceType = 'android' | 'iOS' | 'web' | 'devtools' | 'simulator'
export type SmartappConnectType = 'usb' | 'wifi' | 'newBaiduCloud' | 'mtpaas'

export interface SmartappLaunchOptions {
  deviceType?: SmartappDeviceType
  connectType?: SmartappConnectType
  timeout?: number
  headless?: boolean
  mtpaas?: Record<string, unknown>
  devtoolsPath?: string
  cliPath?: string
  projectPath?: string
  swanCoreVersion?: string
  projectMinVersion?: string
  deviceId?: string
  browserPath?: string
  wdaProjPath?: string
  isRecord?: boolean
  containerInfo?: unknown
  cookies?: unknown
  coverage?: boolean
  webModel?: string
}

export interface SmartappDevicesResult {
  [deviceId: string]: {
    status: number
  }
}

export interface SmartappDriver {
  miniProgram?: MiniProgram
  close?: () => Promise<void> | void
  currentPagePath?: string
  source?: () => Promise<string>
  screenshot?: () => Promise<Buffer>
}

export interface QueryOptions {
  loop?: number
  duration?: number
  retry?: number
}

export interface ScreenshotOptions {
  path?: string
  compressionLevel?: number
}
