/// <reference types="vite/client" />
/// <reference types="wevu" />

export {}

declare global {
  type MP_PLATFORM = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'

  type RUNTIME_PLATFORM = MP_PLATFORM | 'web'

  interface ImportMetaEnv {
    readonly PLATFORM: RUNTIME_PLATFORM
    /**
     * @deprecated 请改用 `PLATFORM`
     */
    readonly MP_PLATFORM: RUNTIME_PLATFORM
    readonly IS_WEB: boolean
    readonly IS_MINIPROGRAM: boolean
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  type __WEAPP_APP_JSON__ = import('@weapp-core/schematics').App
  type __WEAPP_PAGE_JSON__ = import('@weapp-core/schematics').Page
  type __WEAPP_COMPONENT_JSON__ = import('@weapp-core/schematics').Component

  function defineAppJson(config: () => __WEAPP_APP_JSON__): () => __WEAPP_APP_JSON__
  function defineAppJson(config: () => Promise<__WEAPP_APP_JSON__>): () => Promise<__WEAPP_APP_JSON__>
  function defineAppJson(config: __WEAPP_APP_JSON__): __WEAPP_APP_JSON__

  function definePageJson(config: () => __WEAPP_PAGE_JSON__): () => __WEAPP_PAGE_JSON__
  function definePageJson(config: () => Promise<__WEAPP_PAGE_JSON__>): () => Promise<__WEAPP_PAGE_JSON__>
  function definePageJson(config: __WEAPP_PAGE_JSON__): __WEAPP_PAGE_JSON__

  function defineComponentJson(config: () => __WEAPP_COMPONENT_JSON__): () => __WEAPP_COMPONENT_JSON__
  function defineComponentJson(config: () => Promise<__WEAPP_COMPONENT_JSON__>): () => Promise<__WEAPP_COMPONENT_JSON__>
  function defineComponentJson(config: __WEAPP_COMPONENT_JSON__): __WEAPP_COMPONENT_JSON__
}

// MP_PLATFORM
// weapp / swan / alipay / tt / jd / xhs / qq / h5
declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv extends Dict<string> {
        MP_PLATFORM: MP_PLATFORM
        PLATFORM: RUNTIME_PLATFORM
      }
    }
  }
}
