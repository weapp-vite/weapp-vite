import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './base'

export interface SystemInfo {
  brand: string
  model: string
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
  language: string
  version: string
  system: string
  platform: string
}

export interface AppBaseInfo {
  SDKVersion: string
  language: string
  version: string
  platform: string
  enableDebug: boolean
  theme: 'light' | 'dark'
}

export interface MenuButtonBoundingClientRect {
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

export interface WindowInfo {
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
  screenTop: number
  safeArea: {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
}

export interface DeviceInfo {
  brand: string
  model: string
  system: string
  platform: string
  memorySize: number
  benchmarkLevel: number
  abi: string
  deviceOrientation: 'portrait' | 'landscape'
}

export interface SystemSetting {
  bluetoothEnabled: boolean
  wifiEnabled: boolean
  locationEnabled: boolean
  locationReducedAccuracy: boolean
  deviceOrientation: 'portrait' | 'landscape'
}

export type AppAuthorizeStatus = 'authorized' | 'denied' | 'not determined'

export interface AppAuthorizeSetting {
  albumAuthorized: AppAuthorizeStatus
  bluetoothAuthorized: AppAuthorizeStatus
  cameraAuthorized: AppAuthorizeStatus
  locationAuthorized: AppAuthorizeStatus
  microphoneAuthorized: AppAuthorizeStatus
  notificationAuthorized: AppAuthorizeStatus
  phoneCalendarAuthorized: AppAuthorizeStatus
}

export interface OpenAppAuthorizeSettingSuccessResult extends MiniProgramBaseResult, AppAuthorizeSetting {}

export interface OpenAppAuthorizeSettingOptions extends MiniProgramAsyncOptions<OpenAppAuthorizeSettingSuccessResult> {}

export interface LoginSuccessResult extends MiniProgramBaseResult {
  code: string
}

export interface LoginOptions extends MiniProgramAsyncOptions<LoginSuccessResult> {
  timeout?: number
}

export interface CheckSessionOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {}

export interface UserInfo {
  nickName: string
  avatarUrl: string
  gender: 0 | 1 | 2
  country: string
  province: string
  city: string
  language: string
}

export interface UserProfileSuccessResult extends MiniProgramBaseResult {
  userInfo: UserInfo
  rawData: string
  signature: string
  encryptedData: string
  iv: string
}

export interface GetUserInfoOptions extends MiniProgramAsyncOptions<UserProfileSuccessResult> {
  lang?: 'en' | 'zh_CN' | 'zh_TW'
}

export interface GetUserProfileOptions extends MiniProgramAsyncOptions<UserProfileSuccessResult> {
  desc?: string
  lang?: 'en' | 'zh_CN' | 'zh_TW'
}

export interface AccountInfoSync {
  miniProgram: {
    appId: string
    envVersion: 'develop' | 'trial' | 'release'
    version: string
  }
  plugin: Record<string, unknown>
}

export interface GetSystemInfoSuccessResult extends MiniProgramBaseResult, SystemInfo {}

export interface GetSystemInfoOptions extends MiniProgramAsyncOptions<GetSystemInfoSuccessResult> {}
