import type { DocumentInput, LanguagePlatform } from '../types'
import type { TemplateScript } from './types'

/** 分析器、格式器和编辑器共同使用内联脚本身份，避免普通脚本误套 SJS 方言。 */
export function getTemplateScriptInput(fileName: string, script: TemplateScript, platform?: LanguagePlatform): DocumentInput {
  const dialect = script.tagName === 'filter' || script.tagName === 'script' ? 'javascript' : script.tagName === 'wxs' ? 'wxs' : script.tagName === 'ks' ? 'ks' : 'sjs'
  const typed = script.language === 'typescript'
  const extension = script.tagName === 'filter' ? `filter.${typed ? 'ts' : 'js'}` : script.tagName === 'script' ? typed ? 'ts' : 'js' : `${dialect}${script.sourceKind === 'compiled' ? typed ? '.ts' : '.js' : ''}`
  return { source: script.source, fileName: `${fileName}.${extension}`, platform, sourceKind: script.sourceKind, dialect, language: script.language }
}
