import type {
  AccountInfoSync,
  AppAuthorizeSetting,
  AppAuthorizeStatus,
  AppBaseInfo,
  AuthorizeOptions,
  BatteryInfo,
  CheckSessionOptions,
  DeviceInfo,
  GetBatteryInfoSuccessResult,
  GetFuzzyLocationOptions,
  GetLocationOptions,
  GetNetworkTypeOptions,
  GetSettingOptions,
  GetSystemInfoOptions,
  GetUserInfoOptions,
  GetUserProfileOptions,
  LoginOptions,
  MenuButtonBoundingClientRect,
  NetworkStatusChangeCallback,
  OpenAppAuthorizeSettingOptions,
  OpenSettingOptions,
  SystemInfo,
  SystemSetting,
  VibrateShortOptions,
  WindowInfo,
  WindowResizeCallback,
  WxAsyncOptions,
} from './types'
import {
  authorizeBridge,
  checkSessionBridge,
  getAppAuthorizeSettingBridge,
  getSettingBridge,
  getSystemSettingBridge,
  getUserInfoBridge,
  getUserProfileBridge,
  loginBridge,
  openAppAuthorizeSettingBridge,
  openSettingBridge,
} from './authApi'
import {
  getBatteryInfoBridge,
  getBatteryInfoSyncBridge,
  vibrateShortBridge,
} from './deviceApi'
import {
  getFuzzyLocationBridge,
  getLocationBridge,
} from './locationApi'
import { getNetworkTypeBridge } from './menuApi'
import {
  offNetworkStatusChangeBridge,
  offWindowResizeBridge,
  onNetworkStatusChangeBridge,
  onWindowResizeBridge,
} from './runtimeCapabilityApi'
import { resolveDeviceOrientation } from './system'
import {
  getAccountInfoSyncBridge,
  getAppBaseInfoBridge,
  getDeviceInfoBridge,
  getMenuButtonBoundingClientRectBridge,
  getSystemInfoBridge,
  getSystemInfoSyncBridge,
  getWindowInfoBridge,
} from './systemApi'

const WEB_SUPPORTED_AUTH_SCOPES = new Set([
  'scope.userInfo',
  'scope.userLocation',
  'scope.userLocationBackground',
  'scope.address',
  'scope.invoiceTitle',
  'scope.invoice',
  'scope.werun',
  'scope.record',
  'scope.writePhotosAlbum',
  'scope.camera',
])
const APP_AUTHORIZE_SCOPE_MAP: Partial<Record<keyof AppAuthorizeSetting, string>> = {
  albumAuthorized: 'scope.writePhotosAlbum',
  cameraAuthorized: 'scope.camera',
  locationAuthorized: 'scope.userLocation',
  microphoneAuthorized: 'scope.record',
}
const webAuthorizeState = new Map<string, AppAuthorizeStatus>()
for (const scope of WEB_SUPPORTED_AUTH_SCOPES) {
  webAuthorizeState.set(scope, 'not determined')
}

export function vibrateShort(options?: VibrateShortOptions) {
  return vibrateShortBridge(options)
}

export function getBatteryInfoSync(): BatteryInfo {
  return getBatteryInfoSyncBridge()
}

export async function getBatteryInfo(options?: WxAsyncOptions<GetBatteryInfoSuccessResult>) {
  return getBatteryInfoBridge(options)
}

export function getLocation(options?: GetLocationOptions) {
  return getLocationBridge(options)
}

export async function getFuzzyLocation(options?: GetFuzzyLocationOptions) {
  return getFuzzyLocationBridge(options)
}

export function getSetting(options?: GetSettingOptions) {
  return getSettingBridge(options, webAuthorizeState)
}

export function authorize(options?: AuthorizeOptions) {
  return authorizeBridge(options, webAuthorizeState, WEB_SUPPORTED_AUTH_SCOPES)
}

export function openSetting(options?: OpenSettingOptions) {
  return openSettingBridge(options, webAuthorizeState, WEB_SUPPORTED_AUTH_SCOPES)
}

export function getAppAuthorizeSetting(): AppAuthorizeSetting {
  return getAppAuthorizeSettingBridge(webAuthorizeState) as AppAuthorizeSetting
}

export function openAppAuthorizeSetting(options?: OpenAppAuthorizeSettingOptions) {
  return openAppAuthorizeSettingBridge(
    options,
    webAuthorizeState,
    APP_AUTHORIZE_SCOPE_MAP as Record<string, string>,
    getAppAuthorizeSetting,
  )
}

export function getNetworkType(options?: GetNetworkTypeOptions) {
  return getNetworkTypeBridge(options)
}

export function onNetworkStatusChange(callback: NetworkStatusChangeCallback) {
  return onNetworkStatusChangeBridge(callback)
}

export function offNetworkStatusChange(callback?: NetworkStatusChangeCallback) {
  return offNetworkStatusChangeBridge(callback)
}

export function getWindowInfo(): WindowInfo {
  return getWindowInfoBridge()
}

export function onWindowResize(callback: WindowResizeCallback) {
  return onWindowResizeBridge(callback, getWindowInfo)
}

export function offWindowResize(callback?: WindowResizeCallback) {
  return offWindowResizeBridge(callback)
}

export function getSystemInfoSync(): SystemInfo {
  return getSystemInfoSyncBridge()
}

export function getSystemInfo(options?: GetSystemInfoOptions) {
  return getSystemInfoBridge(options)
}

export function getDeviceInfo(): DeviceInfo {
  return getDeviceInfoBridge() as DeviceInfo
}

export function getSystemSetting(): SystemSetting {
  return getSystemSettingBridge(webAuthorizeState, resolveDeviceOrientation)
}

export function login(options?: LoginOptions) {
  return loginBridge(options)
}

export function checkSession(options?: CheckSessionOptions) {
  return checkSessionBridge(options)
}

export function getUserInfo(options?: GetUserInfoOptions) {
  return getUserInfoBridge(options, webAuthorizeState)
}

export function getUserProfile(options?: GetUserProfileOptions) {
  return getUserProfileBridge(options, webAuthorizeState)
}

export function getAccountInfoSync(): AccountInfoSync {
  return getAccountInfoSyncBridge() as AccountInfoSync
}

export function getAppBaseInfo(): AppBaseInfo {
  return getAppBaseInfoBridge() as AppBaseInfo
}

export function getMenuButtonBoundingClientRect(): MenuButtonBoundingClientRect {
  return getMenuButtonBoundingClientRectBridge() as MenuButtonBoundingClientRect
}
