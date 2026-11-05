import type { MpPlatform } from '../types'
import { alipay, jd, swan, tt, weapp, xhs } from '@weapp-vite/wxml/presets'

// Web 的兼容模板渲染器也需要这些语法信息，不应因此依赖 CLI、npm 和项目配置元数据。
export const MINI_PROGRAM_DIRECTIVE_PREFIXES: Readonly<Record<MpPlatform, string>> = Object.freeze({
  weapp: weapp.directivePrefix,
  alipay: alipay.directivePrefix,
  swan: swan.directivePrefix,
  tt: tt.directivePrefix,
  jd: jd.directivePrefix,
  xhs: xhs.directivePrefix,
})

const SUPPORTED_MINI_PROGRAM_DIRECTIVE_PREFIXES = Object.freeze(
  Array.from(new Set(Object.values(MINI_PROGRAM_DIRECTIVE_PREFIXES))),
)

/** 返回所有受支持的小程序模板指令前缀。 */
export function getSupportedMiniProgramDirectivePrefixes(): readonly string[] {
  return SUPPORTED_MINI_PROGRAM_DIRECTIVE_PREFIXES
}

/** 获取平台模板指令前缀，兼容未指定平台时的微信默认值。 */
export function getMiniProgramDirectivePrefix(platform?: MpPlatform): string {
  const prefix = MINI_PROGRAM_DIRECTIVE_PREFIXES[platform ?? 'weapp']
  if (!prefix) {
    throw new Error(`不支持的小程序平台 "${platform}"。`)
  }
  return prefix
}
