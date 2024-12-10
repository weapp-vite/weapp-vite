/// <reference types="vite/client" />

type MP_PLATFORM = 'weapp' | 'alipay' | 'tt'

interface ImportMetaEnv {
  MP_PLATFORM: MP_PLATFORM // | 'swan' | 'alipay' | 'tt' | 'qq' | 'jd' | 'h5'
}
// MP_PLATFORM
// weapp / swan / alipay / tt / qq / jd / h5
declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv extends Dict<string> {
        MP_PLATFORM: MP_PLATFORM
      }
    }
  }
}
