import { getMiniProgramGlobalKeys } from './miniProgramGlobals'

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
  return getMiniProgramGlobalKeys().map((key, index) => {
    const prefix = index === 0 ? '((' : ' || ('
    return `${prefix}typeof ${key} !== 'undefined' && ${key})`
  })
}

export function createNativeApiFallbackExpression() {
  return [
    ...getNativeApiFallbackChecks(),
    ` || undefined)`,
  ].join('')
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
