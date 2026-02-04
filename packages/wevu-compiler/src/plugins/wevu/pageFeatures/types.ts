import type { WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../constants'

export { WE_VU_MODULE_ID } from '../../../constants'

/**
 * wevu 页面特性标识（由钩子映射表推导）。
 */
export type WevuPageFeatureFlag = (typeof WE_VU_PAGE_HOOK_TO_FEATURE)[keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE]
/**
 * wevu 页面钩子名称。
 */
export type WevuPageHookName = keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE

/**
 * 模块解析器，用于注入特性时按需解析模块与源码。
 */
export interface ModuleResolver {
  resolveId: (source: string, importer: string) => Promise<string | undefined>
  loadCode: (id: string) => Promise<string | undefined>
}
