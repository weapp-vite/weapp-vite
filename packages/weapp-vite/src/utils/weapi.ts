import {
  createMiniProgramTopLevelAccessChecks,
  createMiniProgramTopLevelResolveExpression,
  getMiniProgramGlobalKeys,
} from './miniProgramGlobals'

export function getWeapiGlobalHostCandidates() {
  return [
    `((typeof globalThis !== 'undefined' && globalThis)`,
    ` || (typeof self !== 'undefined' && self)`,
    ` || (typeof window !== 'undefined' && window)`,
    ` || (typeof global !== 'undefined' && global)`,
    ...getMiniProgramGlobalKeys().map(key => ` || (typeof ${key} !== 'undefined' && ${key})`),
    ` || {})`,
  ]
}

export function getWeapiGlobalRootCandidateItems() {
  return [
    `(typeof globalThis !== 'undefined' && globalThis)`,
    `(typeof self !== 'undefined' && self)`,
    `(typeof window !== 'undefined' && window)`,
    `(typeof global !== 'undefined' && global)`,
  ]
}

export function getWeapiGlobalHostCandidateItems() {
  return [
    ...getWeapiGlobalRootCandidateItems(),
    ...getMiniProgramGlobalKeys().map(key => `(typeof ${key} !== 'undefined' && ${key})`),
  ]
}

export function createGlobalHostExpression() {
  return getWeapiGlobalHostCandidates().join('')
}

function createUniqueCandidatesExpression(items: string[]) {
  return `([${items.join(',')}].filter(Boolean).filter((item,index,list)=>list.indexOf(item)===index))`
}

export function createGlobalRootCandidatesExpression() {
  return createUniqueCandidatesExpression(getWeapiGlobalRootCandidateItems())
}

export function createGlobalHostCandidatesExpression() {
  return createUniqueCandidatesExpression(getWeapiGlobalHostCandidateItems())
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

export function createWeapiHostCandidatesExpression() {
  return createGlobalRootCandidatesExpression()
}

export function createWeapiAccessExpression(globalName: string) {
  const globalKey = JSON.stringify(globalName)
  const hosts = createGlobalHostCandidatesExpression()
  const nativeFallback = createNativeApiFallbackExpression()
  return `((${hosts}.map(item=>item&&item[${globalKey}]).find(Boolean)) || ${nativeFallback})`
}
