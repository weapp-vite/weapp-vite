import type { Diagnostic, DocumentAnalysis, DocumentInput, LanguageOptions, LanguagePlatform, ScriptAnalysis, ScriptDialect, ScriptExportScope, ScriptFormatResult, ScriptTemplateExports, SourceEdit, TemplateAnalysis, TemplateAttribute, TemplateFormatResult, TemplateToken } from '@weapp-vite/language-service'
import { analyzeDocument, analyzeScript, analyzeTemplate, formatScript, formatTemplate, formatTemplateResult, getLanguageFileAssociations, getLanguageProfile, getLanguageSupportMatrix, getScriptTemplateExports, getTemplateScriptInput, LanguageError, resolveLanguageProfile, scanTemplate } from '@weapp-vite/language-service'
import { expectAssignable, expectError, expectType } from 'tsd'

expectType<string>(formatTemplate('<view/>', 'page.axml', { platform: 'alipay', singleAttributePerLine: true }))
expectType<TemplateAnalysis>(analyzeTemplate({ source: '<view/>', fileName: 'page.qml', platform: 'qq' }))
expectType<DocumentAnalysis>(analyzeDocument({ source: '<view/>', fileName: 'page.wxml' }))
expectType<LanguagePlatform>(getLanguageProfile('alipay').platform)
expectType<LanguagePlatform | undefined>(resolveLanguageProfile('page.sjs')?.platform)
expectAssignable<LanguageOptions>({ defaultPlatform: 'weapp', overrides: [{ files: ['**/alipay/**'], platform: 'alipay' }] })
expectAssignable<LanguageOptions>({ platform: 'weapp', syntax: 'xml' })
expectType<TemplateAnalysis>(analyzeTemplate({ source: '<view a="1"b="2"/>', fileName: 'page.wxml', options: { syntax: 'legacy' } }))
expectType<TemplateFormatResult>(formatTemplateResult('<view/>', 'page.wxml', { syntax: 'xml' }))
expectError(formatTemplateResult('<view/>', 'page.wxml', { syntax: 'html' }))
expectError(analyzeTemplate({ source: '<view/>', fileName: 'page.wxml', options: { syntax: 'html' } }))
expectAssignable<Diagnostic>({ code: 'template/error', message: '错误', severity: 'error', start: 0, end: 1 })
expectType<Diagnostic[]>(new LanguageError('page.wxml', []).diagnostics)
expectType<TemplateFormatResult>(formatTemplateResult('<view/>'))
expectType<SourceEdit[]>(formatTemplateResult('<view/>').edits)
expectAssignable<SourceEdit>({ start: 0, end: 7, newText: '<view />' })
expectAssignable<ScriptDialect>('ks')
expectType<ScriptAnalysis>(analyzeScript({ source: 'module.exports = {}', fileName: 'tools.ks', platform: 'ks' }))
expectType<ScriptAnalysis['references']>(analyzeScript({ source: '', fileName: 'tools.wxs' }).references)
expectType<ScriptAnalysis['symbols']>(analyzeScript({ source: '', fileName: 'tools.wxs' }).symbols)
expectType<ScriptAnalysis['imports']>(analyzeScript({ source: '', fileName: 'tools.wxs' }).imports)
expectType<ScriptAnalysis['externalUses']>(analyzeScript({ source: '', fileName: 'tools.wxs' }).externalUses)
expectType<ScriptExportScope>(analyzeScript({ source: '', fileName: 'tools.wxs' }).imports[0].targetScope)
expectType<ScriptExportScope>(analyzeScript({ source: '', fileName: 'tools.wxs' }).externalUses[0].targetScope)
expectType<ScriptTemplateExports>(getScriptTemplateExports(analyzeScript({ source: '', fileName: 'tools.wxs' }), { platform: 'weapp' }))
expectType<Promise<ScriptFormatResult>>(formatScript('var a=1;', 'tools.wxs', { format: (_fileName, source, options) => {
  expectType<'off'>(options.embeddedLanguageFormatting)
  expectType<'none' | undefined>(options.trailingComma)
  return { code: source, errors: [] }
} }))
expectType<Record<string, string>>(getLanguageFileAssociations())
expectType<LanguagePlatform>(getLanguageSupportMatrix()[0].platform)
expectType<string[]>(getLanguageSupportMatrix()[0].filterExtensions)
expectType<string[] | undefined>(analyzeScript({ source: '', fileName: 'tools.wxs' }).externalUses[0].targetPath)
expectType<DocumentInput>(getTemplateScriptInput('page.swan', { tagName: 'filter', source: '', sourceKind: 'native', start: 0, end: 0 }, 'swan'))
expectError(getLanguageProfile('unknown'))
expectError(analyzeTemplate({ source: '<view/>', fileName: 'page.wxml', platform: 'browser' }))

const scanned = scanTemplate('<view/>')
expectType<TemplateToken[]>(scanned.tokens)
expectType<Diagnostic[]>(scanned.diagnostics)
scanned.tokens.splice(0, 1)
scanned.diagnostics.push({ code: 'custom', message: '可变诊断', severity: 'info', start: 0, end: 0 })
const scannedTag = scanned.tokens[0]
if (scannedTag?.kind === 'tag') {
  expectType<TemplateAttribute[]>(scannedTag.attributes)
  scannedTag.attributes.push({ name: 'added', start: 0, end: 0, nameStart: 0, nameEnd: 0, quote: '"' })
  expectType<'"' | '\'' | undefined>(scannedTag.attributes[0]?.quote)
}
