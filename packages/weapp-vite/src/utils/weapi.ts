import {
  createMiniProgramTopLevelAccessChecks,
  createMiniProgramTopLevelResolveExpression,
  getMiniProgramGlobalKeys,
} from './miniProgramGlobals'

export function getWeapiGlobalHostCandidates() {
  const miniProgramHostCandidates = getMiniProgramGlobalKeys().map((key) => {
    return ` || (typeof ${key} !== 'undefined' && ${key})`
  })
  return [
    `((typeof globalThis !== 'undefined' && globalThis)`,
    ` || (typeof self !== 'undefined' && self)`,
    ` || (typeof window !== 'undefined' && window)`,
    ` || (typeof global !== 'undefined' && global)`,
    ...miniProgramHostCandidates,
    ` || {})`,
  ]
}

export function createGlobalHostExpression() {
  return getWeapiGlobalHostCandidates().join('')
}

export function getNativeApiFallbackChecks() {
  return createMiniProgramTopLevelAccessChecks({
    globalKeys: getMiniProgramGlobalKeys(),
  })
}

export function createNativeApiFallbackExpression() {
  return createMiniProgramTopLevelResolveExpression({
    globalKeys: getMiniProgramGlobalKeys(),
  })
}

export function createWeapiHostExpression() {
  return createGlobalHostExpression()
}

export function createWeapiAccessExpression(globalName: string) {
  const globalKey = JSON.stringify(globalName)
  const host = createGlobalHostExpression()
  const nativeFallback = createNativeApiFallbackExpression()
  return `((${host}[${globalKey}]) || ${nativeFallback})`
}
