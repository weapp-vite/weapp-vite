import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  buildAuthSettingSnapshot,
  buildUserProfilePayload,
  generateLoginCode,
  normalizeAuthScope,
  resolveAuthorizeDecision,
  resolveCheckSessionState,
  resolveUserProfileDecision,
  syncOpenAppAuthorizeSettingPreset,
  syncOpenSettingPreset,
} from './auth'

type AuthState = Map<string, string>

export function getSettingBridge(options: any, authState: AuthState) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'getSetting:ok',
    authSetting: buildAuthSettingSnapshot(authState),
  }))
}

export function authorizeBridge(options: any, authState: AuthState, supportedScopes: Set<string>) {
  const scope = normalizeAuthScope(options?.scope)
  if (!scope) {
    const failure = callWxAsyncFailure(options, 'authorize:fail invalid scope')
    return Promise.reject(failure)
  }
  if (!supportedScopes.has(scope)) {
    const failure = callWxAsyncFailure(options, 'authorize:fail unsupported scope')
    return Promise.reject(failure)
  }
  const decision = resolveAuthorizeDecision(scope)
  authState.set(scope, decision)
  if (decision !== 'authorized') {
    const reason = decision === 'denied' ? 'auth deny' : 'auth canceled'
    const failure = callWxAsyncFailure(options, `authorize:fail ${reason}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'authorize:ok' }))
}

export function openSettingBridge(options: any, authState: AuthState, supportedScopes: Set<string>) {
  syncOpenSettingPreset(authState, supportedScopes)
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'openSetting:ok',
    authSetting: buildAuthSettingSnapshot(authState),
  }))
}

export function openAppAuthorizeSettingBridge(
  options: any,
  authState: AuthState,
  scopeMap: Record<string, string>,
  resolveAppAuthorizeSetting: () => object,
) {
  syncOpenAppAuthorizeSettingPreset(authState, scopeMap)
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'openAppAuthorizeSetting:ok',
    ...resolveAppAuthorizeSetting(),
  }))
}

export function getSystemSettingBridge(authState: AuthState, resolveOrientation: () => 'portrait' | 'landscape') {
  const locationAuthorized = authState.get('scope.userLocation') === 'authorized'
  return {
    bluetoothEnabled: false,
    wifiEnabled: true,
    locationEnabled: locationAuthorized,
    locationReducedAccuracy: false,
    deviceOrientation: resolveOrientation(),
  }
}

export function getAppAuthorizeSettingBridge(authState: AuthState) {
  const resolveStatus = (scope: string) => authState.get(scope) ?? 'not determined'
  return {
    albumAuthorized: resolveStatus('scope.writePhotosAlbum'),
    bluetoothAuthorized: 'not determined',
    cameraAuthorized: resolveStatus('scope.camera'),
    locationAuthorized: resolveStatus('scope.userLocation'),
    microphoneAuthorized: resolveStatus('scope.record'),
    notificationAuthorized: 'not determined',
    phoneCalendarAuthorized: 'not determined',
  }
}

export function loginBridge(options: any) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'login:ok',
    code: generateLoginCode(),
  }))
}

export function checkSessionBridge(options: any) {
  if (!resolveCheckSessionState()) {
    const failure = callWxAsyncFailure(options, 'checkSession:fail session expired')
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'checkSession:ok' }))
}

export function getUserInfoBridge(options: any, authState: AuthState) {
  if (authState.get('scope.userInfo') === 'denied') {
    const failure = callWxAsyncFailure(options, 'getUserInfo:fail auth deny')
    return Promise.reject(failure)
  }
  authState.set('scope.userInfo', 'authorized')
  return Promise.resolve(callWxAsyncSuccess(options, buildUserProfilePayload('getUserInfo:ok', options?.lang)))
}

export function getUserProfileBridge(options: any, authState: AuthState) {
  const desc = typeof options?.desc === 'string' ? options.desc.trim() : ''
  if (!desc) {
    const failure = callWxAsyncFailure(options, 'getUserProfile:fail invalid desc')
    return Promise.reject(failure)
  }
  const decision = resolveUserProfileDecision()
  authState.set('scope.userInfo', decision)
  if (decision !== 'authorized') {
    const reason = decision === 'denied' ? 'auth deny' : 'auth canceled'
    const failure = callWxAsyncFailure(options, `getUserProfile:fail ${reason}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, buildUserProfilePayload('getUserProfile:ok', options?.lang)))
}
