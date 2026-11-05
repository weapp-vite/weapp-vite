import type { TemplatePreset } from '@weapp-vite/wxml/presets'
import type { MiniProgramPlatformDescriptor } from './types'

/** 将纯模板语言事实投影到既有构建描述，不登记任何新增构建平台。 */
export function templateOutputExtensions(preset: TemplatePreset): MiniProgramPlatformDescriptor['outputExtensions'] {
  return {
    js: 'js',
    json: 'json',
    wxml: preset.templateExtension.slice(1),
    wxss: preset.styleExtension.slice(1),
    wxs: preset.portableScriptModule.extension,
  }
}

/** 保留公开 descriptor 的脚本字段形状，扩展名仍由输出配置单独持有。 */
export function templateScriptOptions(preset: TemplatePreset): NonNullable<MiniProgramPlatformDescriptor['scriptModule']> {
  const { format, sourceAttribute, moduleAttribute } = preset.portableScriptModule
  return { format, sourceAttribute, moduleAttribute }
}

/** 既有共享字段允许修改元素；只复制投影，不把冻结预设作为可变对象暴露。 */
export function templateNativeScriptModules(preset: TemplatePreset): NonNullable<MiniProgramPlatformDescriptor['nativeScriptModules']> {
  return preset.nativeScriptModules.map(module => ({ ...module }))
}
