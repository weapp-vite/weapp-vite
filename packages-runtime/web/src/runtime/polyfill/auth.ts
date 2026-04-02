export type AppAuthorizeStatusLike = 'authorized' | 'denied' | 'not determined'

type UserLanguageLike = 'en' | 'zh_CN' | 'zh_TW'

interface UserInfoLike {
  nickName: string
  avatarUrl: string
  gender: 0 | 1 | 2
  country: string
  province: string
  city: string
  language: UserLanguageLike
}

export function normalizeAuthScope(scope: unknown) {
  if (typeof scope !== 'string') {
    return ''
  }
  return scope.trim()
}

export function buildAuthSettingSnapshot(authorizeState: Map<string, AppAuthorizeStatusLike>) {
  const authSetting: Record<string, boolean> = {}
  for (const [scope, status] of authorizeState.entries()) {
    authSetting[scope] = status === 'authorized'
  }
  return authSetting
}

export function normalizeAuthorizeDecision(decision: unknown): AppAuthorizeStatusLike {
  if (decision === true) {
    return 'authorized'
  }
  if (decision === false) {
    return 'denied'
  }
  if (decision === 'authorized' || decision === 'denied' || decision === 'not determined') {
    return decision
  }
  return 'authorized'
}

export function resolveAuthorizeDecision(scope: string): AppAuthorizeStatusLike {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const decisionSource = runtimeGlobal.__weappViteWebAuthorizeDecision
  if (typeof decisionSource === 'function') {
    try {
      return normalizeAuthorizeDecision((decisionSource as (value: string) => unknown)(scope))
    }
    catch {
      return 'authorized'
    }
  }
  if (decisionSource && typeof decisionSource === 'object') {
    return normalizeAuthorizeDecision((decisionSource as Record<string, unknown>)[scope])
  }
  return 'authorized'
}

export function syncOpenSettingPreset(
  authorizeState: Map<string, AppAuthorizeStatusLike>,
  supportedAuthScopes: Set<string>,
) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebOpenSettingAuth
  if (!preset || typeof preset !== 'object') {
    return
  }
  for (const [scope, value] of Object.entries(preset as Record<string, unknown>)) {
    if (!supportedAuthScopes.has(scope)) {
      continue
    }
    authorizeState.set(scope, value ? 'authorized' : 'denied')
  }
}

export function normalizeAppAuthorizeStatus(value: unknown): AppAuthorizeStatusLike {
  if (value === true) {
    return 'authorized'
  }
  if (value === false) {
    return 'denied'
  }
  if (value === 'authorized' || value === 'denied' || value === 'not determined') {
    return value
  }
  return 'not determined'
}

export function syncOpenAppAuthorizeSettingPreset(
  authorizeState: Map<string, AppAuthorizeStatusLike>,
  scopeMap: Partial<Record<string, string>>,
) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebOpenAppAuthorizeSetting
  if (!preset || typeof preset !== 'object') {
    return
  }
  for (const [key, scope] of Object.entries(scopeMap)) {
    if (!scope) {
      continue
    }
    const status = normalizeAppAuthorizeStatus((preset as Record<string, unknown>)[key])
    authorizeState.set(scope, status)
  }
}

export function generateLoginCode() {
  const now = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `web_${now}_${random}`
}

export function normalizeUserLanguage(value: unknown): UserLanguageLike {
  if (value === 'en' || value === 'zh_CN' || value === 'zh_TW') {
    return value
  }
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const language = runtimeNavigator?.language?.toLowerCase() ?? ''
  if (language.startsWith('zh-tw') || language.startsWith('zh-hk')) {
    return 'zh_TW'
  }
  if (language.startsWith('zh')) {
    return 'zh_CN'
  }
  return 'en'
}

function normalizeUserGender(value: unknown): UserInfoLike['gender'] {
  if (value === 1 || value === 2) {
    return value
  }
  return 0
}

function normalizeUserInfoValue(value: unknown, lang: UserLanguageLike) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const info = value as Record<string, unknown>
  return {
    nickName: typeof info.nickName === 'string' && info.nickName.trim() ? info.nickName : 'Web User',
    avatarUrl: typeof info.avatarUrl === 'string' ? info.avatarUrl : '',
    gender: normalizeUserGender(info.gender),
    country: typeof info.country === 'string' ? info.country : '',
    province: typeof info.province === 'string' ? info.province : '',
    city: typeof info.city === 'string' ? info.city : '',
    language: normalizeUserLanguage(info.language ?? lang),
  } satisfies UserInfoLike
}

function resolveUserInfoPreset(source: '__weappViteWebUserInfo' | '__weappViteWebUserProfile', lang: UserLanguageLike) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal[source]
  if (typeof preset === 'function') {
    return normalizeUserInfoValue((preset as () => unknown)(), lang)
  }
  return normalizeUserInfoValue(preset, lang)
}

export function buildUserProfilePayload(errMsg: 'getUserInfo:ok' | 'getUserProfile:ok', optionsLang?: unknown) {
  const language = normalizeUserLanguage(optionsLang)
  const userInfo = resolveUserInfoPreset('__weappViteWebUserProfile', language)
    ?? resolveUserInfoPreset('__weappViteWebUserInfo', language)
    ?? {
      nickName: 'Web User',
      avatarUrl: '',
      gender: 0 as const,
      country: '',
      province: '',
      city: '',
      language,
    }
  const rawData = JSON.stringify(userInfo)
  return {
    errMsg,
    userInfo,
    rawData,
    signature: `web-signature-${rawData.length}`,
    encryptedData: '',
    iv: '',
  }
}

export function resolveCheckSessionState() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebCheckSession
  if (typeof preset === 'boolean') {
    return preset
  }
  if (typeof preset === 'string') {
    return preset.trim() !== 'fail'
  }
  if (preset && typeof preset === 'object' && 'valid' in preset) {
    return Boolean((preset as { valid?: unknown }).valid)
  }
  return true
}

export function resolveUserProfileDecision(): AppAuthorizeStatusLike {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebGetUserProfileDecision
  if (typeof preset === 'function') {
    return normalizeAuthorizeDecision((preset as () => unknown)())
  }
  return normalizeAuthorizeDecision(preset)
}
