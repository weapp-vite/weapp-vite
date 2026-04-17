import type { MpPlatform } from '../../../../../types/platform'
import type { MiniProgramPlatform } from '../platform'
import { getMiniProgramTemplatePreset } from '@weapp-core/shared'
import { alipayPlatform } from './alipay'
import { swanPlatform } from './swan'
import { ttPlatform } from './tt'
import { wechatPlatform as defaultMiniProgramPlatform } from './wechat'

const TEMPLATE_PRESET_PLATFORMS: Record<ReturnType<typeof getMiniProgramTemplatePreset>, MiniProgramPlatform> = {
  wechat: defaultMiniProgramPlatform,
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
 * 默认模板平台对象别名，便于调用方避免继续依赖具体宿主命名。
 */
export const defaultMiniProgramTemplatePlatform = getDefaultMiniProgramTemplatePlatform()

/**
 * 默认模板平台对象别名，便于调用方按“默认平台”语义接入。
 */
export const defaultPlatform = defaultMiniProgramPlatform

/**
 * 默认小程序模板平台实现，当前与微信模板实现保持一致。
 */
export { defaultMiniProgramPlatform }

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
  defaultMiniProgramPlatform as wechatPlatform,
}
