import type { MiniProgramPlatform } from '../platform'
import { wechatPlatform } from './wechat'

/**
 * 默认小程序模板平台实现。
 *
 * 当前默认实现与微信模板适配器保持一致，但调用方应优先依赖该别名，
 * 避免在内部链路继续直接绑定具体宿主命名。
 */
export const defaultMiniProgramPlatform: MiniProgramPlatform = wechatPlatform

/**
 * 默认模板平台对象的简写别名。
 */
export const defaultPlatform = defaultMiniProgramPlatform
