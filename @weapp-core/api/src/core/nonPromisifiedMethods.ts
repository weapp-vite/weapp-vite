import { WEAPI_WX_DIRECT_RETURN_METHODS } from './apiCatalog/wxDirectReturnMethods'

const WEAPI_LEGACY_NON_PROMISIFIED_METHOD_NAMES = [
  'createEditorContext',
  'getOpenDataContext',
] as const

export const WEAPI_NON_PROMISIFIED_METHOD_NAMES = [
  ...WEAPI_WX_DIRECT_RETURN_METHODS,
  ...WEAPI_LEGACY_NON_PROMISIFIED_METHOD_NAMES,
] as const

export type WeapiNonPromisifiedMethodName = typeof WEAPI_NON_PROMISIFIED_METHOD_NAMES[number]

const WEAPI_NON_PROMISIFIED_METHOD_NAME_SET = new Set<string>(WEAPI_NON_PROMISIFIED_METHOD_NAMES)

/**
 * @description 判断方法是否应保留原始同步返回值，而不是包装为 Promise。
 */
export function isNonPromisifiedMethod(name: string): name is WeapiNonPromisifiedMethodName {
  return WEAPI_NON_PROMISIFIED_METHOD_NAME_SET.has(name)
}
