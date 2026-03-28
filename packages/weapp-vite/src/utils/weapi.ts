import { getMiniProgramGlobalKeys } from './miniProgramGlobals'

export function getWeapiGlobalHostCandidates() {
  return [
    `((typeof globalThis !== 'undefined' && globalThis)`,
    ` || (typeof self !== 'undefined' && self)`,
    ` || (typeof window !== 'undefined' && window)`,
    ` || (typeof global !== 'undefined' && global)`,
    ` || (typeof my !== 'undefined' && my)`,
    ` || (typeof wx !== 'undefined' && wx)`,
    ` || (typeof tt !== 'undefined' && tt)`,
    ` || (typeof swan !== 'undefined' && swan)`,
    ` || (typeof jd !== 'undefined' && jd)`,
    ` || (typeof xhs !== 'undefined' && xhs)`,
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
