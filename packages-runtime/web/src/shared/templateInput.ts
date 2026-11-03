import type { MpPlatform } from '@weapp-core/shared/platforms'
import type { Syntax } from '@weapp-vite/wxml'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from '@weapp-core/shared/platforms'

export interface TemplateInputOptions {
  /** 模板来源平台；qq 与 ks 保留历史 XML 模板入口，不代表新增宿主 runtime。 */
  readonly platform?: MpPlatform | 'qq' | 'ks'
  /** 模板实际编码规则；显式配置优先于平台默认。 */
  readonly syntax?: Syntax
  /** 覆盖输入平台的原始脚本标签。 */
  readonly rawTags?: readonly string[]
}

const filenameProfiles = new Map<string, TemplateInputOptions>([
  ...MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => [`.${descriptor.outputExtensions.wxml}`, { platform: descriptor.id, syntax: descriptor.id === 'weapp' ? 'legacy' : 'xml' }] as const),
  ['.qml', { platform: 'qq', syntax: 'xml' }],
  ['.ksml', { platform: 'ks', syntax: 'xml' }],
  ['.html', { syntax: 'xml' }],
])

/** 根据当前文件选择输入规则；未知依赖继承调用方，生成模板可显式覆盖来源编码。 */
export function resolveTemplateInput(filename: string, override: TemplateInputOptions = {}, fallback: TemplateInputOptions = {}): TemplateInputOptions {
  const clean = filename.split('?', 1)[0]!.toLowerCase()
  const extension = clean.slice(Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\')) + 1).match(/\.[^.]+$/)?.[0]
  const inherited = (extension ? filenameProfiles.get(extension) : undefined) ?? fallback
  const platform = override.platform ?? inherited.platform
  const syntax = override.syntax ?? (override.platform ? override.platform === 'weapp' ? 'legacy' : 'xml' : inherited.syntax ?? (platform === 'weapp' ? 'legacy' : 'xml'))
  return { platform, syntax, rawTags: override.rawTags ?? inherited.rawTags }
}
