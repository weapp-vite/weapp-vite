/// <reference types="vite/client" />

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
