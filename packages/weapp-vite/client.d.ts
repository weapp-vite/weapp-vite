/// <reference types="vite/client" />
/// <reference types="wevu" />

export {}

declare global {
  type RUNTIME_PLATFORM = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' | 'web'

  const wpi: import('@wevu/api').WeapiInstance

  interface ImportMetaEnv {
    /**
     * 当前运行平台标识。
     * @example
     * if (import.meta.env.PLATFORM === 'weapp') {
     *   console.log('WeChat Mini Program')
     * }
     */
    readonly PLATFORM: RUNTIME_PLATFORM
    /**
     * 是否 Web 运行时（H5）。
     * @example
     * if (import.meta.env.IS_WEB) {
     *   // web-only logic
     * }
     */
    readonly IS_WEB: boolean
    /**
     * 是否小程序运行时。
     * @example
     * if (import.meta.env.IS_MINIPROGRAM) {
     *   // miniprogram-only logic
     * }
     */
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

declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv extends Dict<string> {
        PLATFORM: RUNTIME_PLATFORM
      }
    }
  }
}
