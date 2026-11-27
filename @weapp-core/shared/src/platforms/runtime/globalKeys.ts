/** 各小程序平台的 runtime 全局对象 key；轻量运行时只依赖此列表，不加载完整平台注册表。 */
export const WEAPP_RUNTIME_GLOBAL_KEY = 'wx'
export const ALIPAY_RUNTIME_GLOBAL_KEY = 'my'
export const SWAN_RUNTIME_GLOBAL_KEY = 'swan'
export const TT_RUNTIME_GLOBAL_KEY = 'tt'
export const JD_RUNTIME_GLOBAL_KEY = 'jd'
export const XHS_RUNTIME_GLOBAL_KEY = 'xhs'

export const MINI_PROGRAM_RUNTIME_GLOBAL_KEYS = Object.freeze([
  WEAPP_RUNTIME_GLOBAL_KEY,
  ALIPAY_RUNTIME_GLOBAL_KEY,
  SWAN_RUNTIME_GLOBAL_KEY,
  TT_RUNTIME_GLOBAL_KEY,
  JD_RUNTIME_GLOBAL_KEY,
  XHS_RUNTIME_GLOBAL_KEY,
]) as readonly string[]
