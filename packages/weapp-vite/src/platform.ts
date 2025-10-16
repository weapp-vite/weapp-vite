import type { MpPlatform } from './types'

export const DEFAULT_MP_PLATFORM: MpPlatform = 'weapp'

export const MINI_PLATFORM_ALIASES: Readonly<Record<string, MpPlatform>> = {
  weapp: 'weapp',
  wechat: 'weapp',
  wx: 'weapp',
  alipay: 'alipay',
  ali: 'alipay',
  my: 'alipay',
  swan: 'swan',
  baidu: 'swan',
  bd: 'swan',
  tt: 'tt',
  toutiao: 'tt',
  bytedance: 'tt',
  douyin: 'tt',
  jd: 'jd',
  jingdong: 'jd',
}

export function normalizeMiniPlatform(input?: string | null): string | undefined {
  return input ? input.trim().toLowerCase() : undefined
}

export function resolveMiniPlatform(input?: string | null): MpPlatform | undefined {
  const normalized = normalizeMiniPlatform(input)
  if (!normalized) {
    return undefined
  }
  return MINI_PLATFORM_ALIASES[normalized]
}
