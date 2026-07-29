import {
  WEAPP_VITE_WEB_AUTHORIZE_DECISION_KEY,
  WEAPP_VITE_WEB_CHECK_SESSION_KEY,
  WEAPP_VITE_WEB_GET_USER_PROFILE_DECISION_KEY,
  WEAPP_VITE_WEB_OPEN_APP_AUTHORIZE_SETTING_KEY,
  WEAPP_VITE_WEB_OPEN_SETTING_AUTH_KEY,
  WEAPP_VITE_WEB_USER_INFO_KEY,
  WEAPP_VITE_WEB_USER_PROFILE_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthSettingSnapshot,
  buildUserProfilePayload,
  generateLoginCode,
  normalizeAppAuthorizeStatus,
  normalizeAuthorizeDecision,
  normalizeAuthScope,
  normalizeUserLanguage,
  resolveAuthorizeDecision,
  resolveCheckSessionState,
  resolveUserProfileDecision,
  syncOpenAppAuthorizeSettingPreset,
  syncOpenSettingPreset,
} from '../src/runtime/polyfill/auth'
import {
  authorizeBridge,
  getAppAuthorizeSettingBridge,
  getUserProfileBridge,
} from '../src/runtime/polyfill/authApi'

describe('web auth capability contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes scopes, decisions and authorization snapshots', () => {
    expect(normalizeAuthScope(null)).toBe('')
    expect(normalizeAuthScope(' scope.camera ')).toBe('scope.camera')
    expect(normalizeAuthorizeDecision(true)).toBe('authorized')
    expect(normalizeAuthorizeDecision(false)).toBe('denied')
    expect(normalizeAuthorizeDecision('authorized')).toBe('authorized')
    expect(normalizeAuthorizeDecision('denied')).toBe('denied')
    expect(normalizeAuthorizeDecision('not determined')).toBe('not determined')
    expect(normalizeAuthorizeDecision('invalid')).toBe('authorized')
    expect(buildAuthSettingSnapshot(new Map([
      ['scope.camera', 'authorized'],
      ['scope.location', 'denied'],
    ]))).toEqual({
      'scope.camera': true,
      'scope.location': false,
    })
  })

  it('resolves authorization decisions from functions, maps and defaults', () => {
    vi.stubGlobal(WEAPP_VITE_WEB_AUTHORIZE_DECISION_KEY, (scope: string) => scope !== 'scope.camera')
    expect(resolveAuthorizeDecision('scope.camera')).toBe('denied')
    expect(resolveAuthorizeDecision('scope.location')).toBe('authorized')

    vi.stubGlobal(WEAPP_VITE_WEB_AUTHORIZE_DECISION_KEY, () => {
      throw new Error('host failure')
    })
    expect(resolveAuthorizeDecision('scope.camera')).toBe('authorized')

    vi.stubGlobal(WEAPP_VITE_WEB_AUTHORIZE_DECISION_KEY, { 'scope.camera': 'not determined' })
    expect(resolveAuthorizeDecision('scope.camera')).toBe('not determined')
    vi.stubGlobal(WEAPP_VITE_WEB_AUTHORIZE_DECISION_KEY, null)
    expect(resolveAuthorizeDecision('scope.camera')).toBe('authorized')
  })

  it('synchronizes supported setting and app authorization presets', () => {
    const authorizeState = new Map()
    const supported = new Set(['scope.camera', 'scope.location'])
    vi.stubGlobal(WEAPP_VITE_WEB_OPEN_SETTING_AUTH_KEY, null)
    syncOpenSettingPreset(authorizeState, supported)
    vi.stubGlobal(WEAPP_VITE_WEB_OPEN_SETTING_AUTH_KEY, {
      'scope.camera': true,
      'scope.location': 0,
      'scope.unsupported': true,
    })
    syncOpenSettingPreset(authorizeState, supported)
    expect(buildAuthSettingSnapshot(authorizeState)).toEqual({
      'scope.camera': true,
      'scope.location': false,
    })

    expect(normalizeAppAuthorizeStatus(true)).toBe('authorized')
    expect(normalizeAppAuthorizeStatus(false)).toBe('denied')
    expect(normalizeAppAuthorizeStatus('authorized')).toBe('authorized')
    expect(normalizeAppAuthorizeStatus('denied')).toBe('denied')
    expect(normalizeAppAuthorizeStatus('not determined')).toBe('not determined')
    expect(normalizeAppAuthorizeStatus('invalid')).toBe('not determined')

    vi.stubGlobal(WEAPP_VITE_WEB_OPEN_APP_AUTHORIZE_SETTING_KEY, undefined)
    syncOpenAppAuthorizeSettingPreset(authorizeState, {})
    vi.stubGlobal(WEAPP_VITE_WEB_OPEN_APP_AUTHORIZE_SETTING_KEY, {
      cameraAuthorized: true,
      locationAuthorized: false,
      microphoneAuthorized: 'not determined',
    })
    syncOpenAppAuthorizeSettingPreset(authorizeState, {
      cameraAuthorized: 'scope.camera',
      locationAuthorized: 'scope.location',
      microphoneAuthorized: 'scope.microphone',
      albumAuthorized: undefined,
    })
    expect(authorizeState).toEqual(new Map([
      ['scope.camera', 'authorized'],
      ['scope.location', 'denied'],
      ['scope.microphone', 'not determined'],
    ]))
  })

  it('normalizes explicit and browser-derived user languages', () => {
    expect(normalizeUserLanguage('en')).toBe('en')
    expect(normalizeUserLanguage('zh_CN')).toBe('zh_CN')
    expect(normalizeUserLanguage('zh_TW')).toBe('zh_TW')

    vi.stubGlobal('navigator', undefined)
    expect(normalizeUserLanguage(undefined)).toBe('en')
    vi.stubGlobal('navigator', { language: 'zh-TW' })
    expect(normalizeUserLanguage(undefined)).toBe('zh_TW')
    vi.stubGlobal('navigator', { language: 'zh-HK' })
    expect(normalizeUserLanguage(undefined)).toBe('zh_TW')
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    expect(normalizeUserLanguage(undefined)).toBe('zh_CN')
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(normalizeUserLanguage(undefined)).toBe('en')
  })

  it('builds user payloads from profile, user-info and default presets', () => {
    vi.stubGlobal(WEAPP_VITE_WEB_USER_PROFILE_KEY, () => ({
      nickName: 'Ada',
      avatarUrl: '/avatar.png',
      gender: 2,
      country: 'CN',
      province: 'ZJ',
      city: 'HZ',
      language: 'zh_TW',
    }))
    let payload = buildUserProfilePayload('getUserProfile:ok', 'en')
    expect(payload.userInfo).toEqual({
      nickName: 'Ada',
      avatarUrl: '/avatar.png',
      gender: 2,
      country: 'CN',
      province: 'ZJ',
      city: 'HZ',
      language: 'zh_TW',
    })
    expect(payload.signature).toBe(`web-signature-${payload.rawData.length}`)

    vi.stubGlobal(WEAPP_VITE_WEB_USER_PROFILE_KEY, null)
    vi.stubGlobal(WEAPP_VITE_WEB_USER_INFO_KEY, {
      nickName: ' ',
      avatarUrl: 1,
      gender: 1,
      country: null,
      province: null,
      city: null,
      language: null,
    })
    payload = buildUserProfilePayload('getUserInfo:ok', 'zh_CN')
    expect(payload.userInfo).toEqual({
      nickName: 'Web User',
      avatarUrl: '',
      gender: 1,
      country: '',
      province: '',
      city: '',
      language: 'zh_CN',
    })

    vi.stubGlobal(WEAPP_VITE_WEB_USER_INFO_KEY, { gender: 'invalid' })
    payload = buildUserProfilePayload('getUserInfo:ok', 'en')
    expect(payload.userInfo.gender).toBe(0)

    vi.stubGlobal(WEAPP_VITE_WEB_USER_INFO_KEY, false)
    payload = buildUserProfilePayload('getUserInfo:ok', 'en')
    expect(payload.userInfo).toMatchObject({ nickName: 'Web User', gender: 0, language: 'en' })
  })

  it('resolves session and profile decisions for every host value shape', () => {
    vi.stubGlobal(WEAPP_VITE_WEB_CHECK_SESSION_KEY, true)
    expect(resolveCheckSessionState()).toBe(true)
    vi.stubGlobal(WEAPP_VITE_WEB_CHECK_SESSION_KEY, false)
    expect(resolveCheckSessionState()).toBe(false)
    vi.stubGlobal(WEAPP_VITE_WEB_CHECK_SESSION_KEY, ' fail ')
    expect(resolveCheckSessionState()).toBe(false)
    vi.stubGlobal(WEAPP_VITE_WEB_CHECK_SESSION_KEY, 'ready')
    expect(resolveCheckSessionState()).toBe(true)
    vi.stubGlobal(WEAPP_VITE_WEB_CHECK_SESSION_KEY, { valid: 0 })
    expect(resolveCheckSessionState()).toBe(false)
    vi.stubGlobal(WEAPP_VITE_WEB_CHECK_SESSION_KEY, { other: true })
    expect(resolveCheckSessionState()).toBe(true)

    vi.stubGlobal(WEAPP_VITE_WEB_GET_USER_PROFILE_DECISION_KEY, () => false)
    expect(resolveUserProfileDecision()).toBe('denied')
    vi.stubGlobal(WEAPP_VITE_WEB_GET_USER_PROFILE_DECISION_KEY, 'not determined')
    expect(resolveUserProfileDecision()).toBe('not determined')
  })

  it('generates deterministic login code structure', () => {
    vi.spyOn(Date, 'now').mockReturnValue(36)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(generateLoginCode()).toMatch(/^web_10_[a-z0-9]{1,8}$/)
  })

  it('rejects unsupported authorization scopes at the API boundary', async () => {
    await expect(authorizeBridge(
      { scope: 'scope.unsupported' },
      new Map(),
      new Set(['scope.camera']),
    )).rejects.toMatchObject({ errMsg: 'authorize:fail unsupported scope' })
  })

  it('maps canceled authorization and explicit app statuses', async () => {
    vi.stubGlobal(WEAPP_VITE_WEB_AUTHORIZE_DECISION_KEY, { 'scope.camera': 'not determined' })
    await expect(authorizeBridge(
      { scope: 'scope.camera' },
      new Map(),
      new Set(['scope.camera']),
    )).rejects.toMatchObject({ errMsg: 'authorize:fail auth canceled' })
    expect(getAppAuthorizeSettingBridge(new Map([['scope.camera', 'authorized']]))).toMatchObject({
      cameraAuthorized: 'authorized',
    })

    vi.stubGlobal(WEAPP_VITE_WEB_GET_USER_PROFILE_DECISION_KEY, 'not determined')
    await expect(getUserProfileBridge({ desc: 'profile' }, new Map())).rejects.toMatchObject({
      errMsg: 'getUserProfile:fail auth canceled',
    })
    await expect(getUserProfileBridge({ desc: 1 }, new Map())).rejects.toMatchObject({
      errMsg: 'getUserProfile:fail invalid desc',
    })
  })
})
