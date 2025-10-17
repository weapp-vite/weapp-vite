/// <reference types="vite/client" />

type MP_PLATFORM = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'

interface ImportMetaEnv {
  MP_PLATFORM: MP_PLATFORM // | 'qq' | 'h5'
}
// MP_PLATFORM
// weapp / swan / alipay / tt / jd / xhs / qq / h5
declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv extends Dict<string> {
        MP_PLATFORM: MP_PLATFORM
      }
    }
  }
}
