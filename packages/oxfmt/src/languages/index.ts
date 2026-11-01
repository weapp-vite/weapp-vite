import type { DocumentInput, LanguageOptions } from '@weapp-vite/language-service'
import type { FormatConfig } from 'vite-plus/fmt'
import { analyzeDocument, formatScript, formatTemplate, getTemplateScriptInput, isScriptModuleFile, LanguageError, resolveLanguageProfile, STYLE_EXTENSIONS, TEMPLATE_EXTENSIONS } from '@weapp-vite/language-service'
import { formatOptions } from '../options'

export type DocumentFormatOptions = FormatConfig & LanguageOptions & Pick<DocumentInput, 'sourceKind' | 'dialect' | 'language'>

/** 同一公开入口供 CLI 与编辑器格式化模板、内联/独立模块及原生样式。 */
export async function formatDocument(source: string, fileName: string, options: DocumentFormatOptions = formatOptions): Promise<string> {
  const profile = resolveLanguageProfile(fileName, options)
  const normalized = fileName.toLowerCase()
  const settings = { ...options }
  if (TEMPLATE_EXTENSIONS.some(extension => normalized.endsWith(extension))) {
    const analysis = analyzeDocument({ source, fileName, options })
    if (!analysis.valid) {
      throw new LanguageError(fileName, analysis.diagnostics.filter(diagnostic => diagnostic.severity === 'error'))
    }
    let formatted = source
    for (const script of [...(analysis.template?.scripts ?? [])].sort((left, right) => right.start - left.start)) {
      const input = getTemplateScriptInput(fileName, script, analysis.platform)
      const result = await formatScript(input.source, input.fileName, {
        platform: input.platform,
        sourceKind: input.sourceKind,
        language: input.language,
        dialect: input.dialect,
        format: async (virtualFile, code, required) => {
          const { format } = await import('vite-plus/fmt')
          return format(virtualFile, code, { ...settings, ...required })
        },
      })
      if (result.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
        throw new LanguageError(fileName, result.diagnostics.map(diagnostic => ({ ...diagnostic, start: diagnostic.start + script.start, end: diagnostic.end + script.start })))
      }
      formatted = formatted.slice(0, script.start) + result.code + formatted.slice(script.end)
    }
    return formatTemplate(formatted, fileName, settings)
  }
  const { format } = await import('vite-plus/fmt').catch((cause: unknown) => {
    throw new Error('脚本与样式格式化需要项目安装 Vite+ >=1.2.0。', { cause })
  })
  if (isScriptModuleFile(normalized) || options.dialect) {
    const result = await formatScript(source, fileName, {
      platform: profile?.platform,
      sourceKind: options.sourceKind,
      dialect: options.dialect,
      language: options.language,
      format: (virtualFile, code, required) => format(virtualFile, code, { ...settings, ...required }),
    })
    if (result.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
      throw new LanguageError(fileName, result.diagnostics)
    }
    return result.code
  }
  const virtualFile = STYLE_EXTENSIONS.some(extension => normalized.endsWith(extension)) ? `${fileName}.css` : fileName
  const result = await format(virtualFile, source, settings)
  if (result.errors.length > 0) {
    throw new Error(`${fileName}: ${result.errors.map(error => error.message).join('\n')}`)
  }
  return result.code
}
