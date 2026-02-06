function createGlobalHostExpression() {
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
  ].join('')
}

function createNativeApiFallbackExpression() {
  return [
    `((typeof my !== 'undefined' && my)`,
    ` || (typeof wx !== 'undefined' && wx)`,
    ` || (typeof tt !== 'undefined' && tt)`,
    ` || (typeof swan !== 'undefined' && swan)`,
    ` || (typeof jd !== 'undefined' && jd)`,
    ` || (typeof xhs !== 'undefined' && xhs)`,
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
