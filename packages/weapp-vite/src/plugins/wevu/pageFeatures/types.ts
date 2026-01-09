import type { WE_VU_PAGE_HOOK_TO_FEATURE } from 'wevu/compiler'

export { WE_VU_MODULE_ID } from 'wevu/compiler'

export type WevuPageFeatureFlag = (typeof WE_VU_PAGE_HOOK_TO_FEATURE)[keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE]
export type WevuPageHookName = keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE

export interface ModuleResolver {
  resolveId: (source: string, importer: string) => Promise<string | undefined>
  loadCode: (id: string) => Promise<string | undefined>
}
