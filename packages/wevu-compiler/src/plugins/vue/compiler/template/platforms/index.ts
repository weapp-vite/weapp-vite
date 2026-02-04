import type { MpPlatform } from '../../../../../types/platform'
import type { MiniProgramPlatform } from '../platform'
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

/**
 * 获取指定平台的模板适配器，默认回退到 wechat。
 */
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
