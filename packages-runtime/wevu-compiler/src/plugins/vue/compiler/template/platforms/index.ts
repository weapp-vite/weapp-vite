import type { MpPlatform } from '../../../../../types/platform'
import type { MiniProgramPlatform } from '../platform'
import { getMiniProgramTemplatePreset } from '@weapp-core/shared'
import { alipayPlatform } from './alipay'
import { swanPlatform } from './swan'
import { ttPlatform } from './tt'
import { wechatPlatform } from './wechat'

const TEMPLATE_PRESET_PLATFORMS: Record<ReturnType<typeof getMiniProgramTemplatePreset>, MiniProgramPlatform> = {
  wechat: wechatPlatform,
  alipay: alipayPlatform,
  tt: ttPlatform,
  swan: swanPlatform,
}

/**
 * 获取指定平台的模板适配器，默认回退到 wechat。
 */
export function getMiniProgramTemplatePlatform(platform?: MpPlatform): MiniProgramPlatform {
  const preset = getMiniProgramTemplatePreset(platform)
  return TEMPLATE_PRESET_PLATFORMS[preset] ?? wechatPlatform
}

export {
  alipayPlatform,
  swanPlatform,
  ttPlatform,
  wechatPlatform,
}
