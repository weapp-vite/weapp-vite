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
 * 获取默认模板适配器。
 */
export function getDefaultMiniProgramTemplatePlatform(): MiniProgramPlatform {
  return TEMPLATE_PRESET_PLATFORMS[getMiniProgramTemplatePreset()]
}

/**
 * 获取指定平台的模板适配器，默认回退到默认模板平台。
 */
export function getMiniProgramTemplatePlatform(platform?: MpPlatform): MiniProgramPlatform {
  const preset = getMiniProgramTemplatePreset(platform)
  return TEMPLATE_PRESET_PLATFORMS[preset] ?? getDefaultMiniProgramTemplatePlatform()
}

export {
  alipayPlatform,
  swanPlatform,
  ttPlatform,
  wechatPlatform,
}
