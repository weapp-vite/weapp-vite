import type { MiniProgramPlatform } from '../platform'
import type { MpPlatform } from '@/types'
import { alipayPlatform } from './alipay'
import { swanPlatform } from './swan'
import { ttPlatform } from './tt'
import { wechatPlatform } from './wechat'

const TEMPLATE_PLATFORMS: Record<MpPlatform, MiniProgramPlatform> = {
  weapp: wechatPlatform,
  alipay: alipayPlatform,
  tt: ttPlatform,
  swan: swanPlatform,
  jd: wechatPlatform,
  xhs: wechatPlatform,
}

export function getMiniProgramTemplatePlatform(platform?: MpPlatform): MiniProgramPlatform {
  if (!platform) {
    return wechatPlatform
  }
  return TEMPLATE_PLATFORMS[platform] ?? wechatPlatform
}

export {
  alipayPlatform,
  swanPlatform,
  ttPlatform,
  wechatPlatform,
}
