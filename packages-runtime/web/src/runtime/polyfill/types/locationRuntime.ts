import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './base'

export interface GetLocationSuccessResult extends MiniProgramBaseResult {
  latitude: number
  longitude: number
  speed: number
  accuracy: number
  altitude: number
  verticalAccuracy: number
  horizontalAccuracy: number
}

export interface GetLocationOptions extends MiniProgramAsyncOptions<GetLocationSuccessResult> {
  type?: 'wgs84' | 'gcj02'
  altitude?: boolean
  isHighAccuracy?: boolean
  highAccuracyExpireTime?: number
}

export interface GetFuzzyLocationSuccessResult extends MiniProgramBaseResult {
  latitude: number
  longitude: number
  accuracy: number
}

export interface GetFuzzyLocationOptions extends MiniProgramAsyncOptions<GetFuzzyLocationSuccessResult> {}

export type NetworkType = 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none'

export interface NetworkStatusResult {
  isConnected: boolean
  networkType: NetworkType
}

export interface GetNetworkTypeSuccessResult extends MiniProgramBaseResult, NetworkStatusResult {}

export interface GetNetworkTypeOptions extends MiniProgramAsyncOptions<GetNetworkTypeSuccessResult> {}

export type NetworkStatusChangeCallback = (result: NetworkStatusResult) => void

export interface WindowResizeResult {
  size: {
    windowWidth: number
    windowHeight: number
  }
  windowWidth: number
  windowHeight: number
}

export type WindowResizeCallback = (result: WindowResizeResult) => void

export interface ShowLoadingOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  title?: string
  mask?: boolean
}

export interface SetBackgroundColorOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  backgroundColor?: string
  backgroundColorTop?: string
  backgroundColorBottom?: string
}

export interface SetBackgroundTextStyleOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  textStyle?: 'dark' | 'light'
}

export interface ShareMenuOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  withShareTicket?: boolean
  menus?: string[]
}

export interface NavigateToMiniProgramOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  appId?: string
  path?: string
  extraData?: Record<string, any>
  envVersion?: 'develop' | 'trial' | 'release'
}

export interface LoadSubPackageOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  name?: string
  root?: string
}

export interface PreloadSubpackageOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  name?: string
  root?: string
}

export interface UpdateManagerCheckResult {
  hasUpdate: boolean
}

export interface UpdateManager {
  applyUpdate: () => void
  onCheckForUpdate: (callback: (result: UpdateManagerCheckResult) => void) => void
  onUpdateReady: (callback: () => void) => void
  onUpdateFailed: (callback: () => void) => void
}

export interface LogManagerOptions {
  level?: 0 | 1
}

export interface LogManager {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
}

export interface ChooseLocationSuccessResult extends MiniProgramBaseResult {
  name: string
  address: string
  latitude: number
  longitude: number
}

export interface ChooseLocationOptions extends MiniProgramAsyncOptions<ChooseLocationSuccessResult> {}

export interface ChooseAddressSuccessResult extends MiniProgramBaseResult {
  userName: string
  postalCode: string
  provinceName: string
  cityName: string
  countyName: string
  detailInfo: string
  nationalCode: string
  telNumber: string
}

export interface ChooseAddressOptions extends MiniProgramAsyncOptions<ChooseAddressSuccessResult> {}

export interface GetImageInfoSuccessResult extends MiniProgramBaseResult {
  width: number
  height: number
  path: string
  type: string
  orientation: 'up'
}

export interface GetImageInfoOptions extends MiniProgramAsyncOptions<GetImageInfoSuccessResult> {
  src?: string
}

export interface MakePhoneCallOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  phoneNumber?: string
}

export interface OpenLocationOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  latitude?: number
  longitude?: number
  scale?: number
  name?: string
  address?: string
}

export interface TabBarOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  animation?: boolean
}

export interface OpenCustomerServiceChatOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  corpId?: string
  extInfo?: Record<string, any>
  url?: string
}

export interface RequestPaymentOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
}

export interface RequestSubscribeMessageSuccessResult extends MiniProgramBaseResult {
  [tmplId: string]: string
}

export interface RequestSubscribeMessageOptions extends MiniProgramAsyncOptions<RequestSubscribeMessageSuccessResult> {
  tmplIds?: string[]
}
