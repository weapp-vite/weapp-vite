import type { ScriptAnalysis } from './script/types'
import type { TemplateAnalysis } from './template'
import type { Diagnostic, DocumentInput, LanguagePlatform } from './types'
import { getLanguageProfile, isScriptModuleFile, resolveLanguageProfile, STYLE_EXTENSIONS, TEMPLATE_EXTENSIONS } from './profiles'
import { analyzeScript } from './script'
import { analyzeTemplate, getTemplateScriptInput } from './template'

export * from './profiles'
export * from './schema'
export * from './script'
export * from './support'
export * from './template'
export * from './types'

export interface DocumentAnalysis {
  kind: 'template' | 'script' | 'style' | 'unknown'
  platform?: LanguagePlatform
  valid: boolean
  diagnostics: Diagnostic[]
  template?: TemplateAnalysis
  script?: ScriptAnalysis
}

/** 统一分析项目文件和内联脚本，所有诊断使用输入文档的 UTF-16 偏移。 */
export function analyzeDocument(input: DocumentInput): DocumentAnalysis {
  const fileName = input.fileName.toLowerCase()
  const profile = input.platform ? getLanguageProfile(input.platform) : resolveLanguageProfile(input.fileName, input.options)
  if (TEMPLATE_EXTENSIONS.some(extension => fileName.endsWith(extension))) {
    const template = analyzeTemplate(input)
    const diagnostics = [...template.diagnostics]
    for (const script of template.scripts) {
      const analyzed = analyzeScript(getTemplateScriptInput(input.fileName, script, template.platform))
      diagnostics.push(...analyzed.diagnostics.map(diagnostic => ({ ...diagnostic, start: diagnostic.start + script.start, end: diagnostic.end + script.start })))
    }
    return { kind: 'template', platform: template.platform, valid: diagnostics.every(diagnostic => diagnostic.severity !== 'error'), diagnostics, template }
  }
  if (isScriptModuleFile(fileName) || /\.[cm]?[jt]sx?$/.test(fileName)) {
    const script = analyzeScript({ ...input, platform: profile?.platform })
    return { kind: 'script', platform: profile?.platform, valid: script.valid, diagnostics: script.diagnostics, script }
  }
  return { kind: STYLE_EXTENSIONS.some(extension => fileName.endsWith(extension)) ? 'style' : 'unknown', platform: profile?.platform, valid: true, diagnostics: [] }
}
