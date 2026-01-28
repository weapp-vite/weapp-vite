import type { WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../constants'

export { WE_VU_MODULE_ID } from '../../../constants'

export type WevuPageFeatureFlag = (typeof WE_VU_PAGE_HOOK_TO_FEATURE)[keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE]
export type WevuPageHookName = keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE

export interface ModuleResolver {
  resolveId: (source: string, importer: string) => Promise<string | undefined>
  loadCode: (id: string) => Promise<string | undefined>
}
