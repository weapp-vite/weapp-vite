import { getSupportedMiniProgramDirectivePrefixes } from '@weapp-core/shared'
import { changeFileExtension } from '../../../utils/file'
import { normalizeImportSjsAttributes } from '../../../utils/wxmlScriptModule'
import { shouldNormalizeTemplateImportSource } from '../../../wxml/shared'

const WXS_TAG_RE = /<\s*(?:\/\s*)?wxs\b/g
const ELSE_ATTRIBUTE_RE = /\selse(?=[\s/>])/
const TEMPLATE_IMPORT_TAG_RE = /<\s*(import|include)\b[^>]*>/g
const TEMPLATE_IMPORT_SRC_RE = /\bsrc\s*=\s*(['"])([^'"]+)\1/
const WXS_LITERAL_RE = /wxs/g
const NON_ALIPAY_DIRECTIVE_PREFIX_PATTERN = getSupportedMiniProgramDirectivePrefixes()
  .filter(prefix => prefix !== 'a')
  .join('|')
const MP_DIRECTIVE_PREFIX_PATTERN = getSupportedMiniProgramDirectivePrefixes().join('|')
const NON_ALIPAY_DIRECTIVE_RE = new RegExp(`\\b(?:${NON_ALIPAY_DIRECTIVE_PREFIX_PATTERN}):(?:if|elif|else|for|for-item|for-index|key)\\b`)
const MP_DIRECTIVE_CAPTURE_RE = new RegExp(`\\b(?:${MP_DIRECTIVE_PREFIX_PATTERN}):(if|elif|else|for|for-item|for-index|key)\\b`, 'g')

export const ALIPAY_TEMPLATE_EXTENSION_MAP: Readonly<Record<string, string>> = Object.freeze({
  '.wxml': '.axml',
  '.wxss': '.acss',
  '.wxs': '.sjs',
})

const ALIPAY_REFERENCE_EXTENSION_RE = new RegExp(
  Object.keys(ALIPAY_TEMPLATE_EXTENSION_MAP)
    .map(ext => ext.replace('.', '\\.'))
    .join('|'),
  'g',
)

export function containsIncompatibleAlipayTemplateSyntax(source: string) {
  return NON_ALIPAY_DIRECTIVE_RE.test(source) || WXS_TAG_RE.test(source) || ELSE_ATTRIBUTE_RE.test(source)
}

export function rewriteTemplateImportExtensionsForAlipay(source: string) {
  return source.replace(TEMPLATE_IMPORT_TAG_RE, (tag) => {
    return tag.replace(TEMPLATE_IMPORT_SRC_RE, (attr, quote: string, value: string) => {
      if (!shouldNormalizeTemplateImportSource(value)) {
        return attr
      }
      let nextValue = changeFileExtension(value, '.axml')
      if (value.startsWith('./') && !nextValue.startsWith('./') && !nextValue.startsWith('../') && !nextValue.startsWith('/')) {
        nextValue = `./${nextValue}`
      }
      return `src=${quote}${nextValue}${quote}`
    })
  })
}

export function rewriteAlipayReferenceExtensions(source: string) {
  return source.replace(ALIPAY_REFERENCE_EXTENSION_RE, (ext) => {
    return ALIPAY_TEMPLATE_EXTENSION_MAP[ext] ?? ext
  })
}

export function rewriteAlipayTemplateSyntax(source: string) {
  return source
    .replace(MP_DIRECTIVE_CAPTURE_RE, (_, directive: string) => `a:${directive}`)
    .replace(WXS_TAG_RE, match => match.replace(WXS_LITERAL_RE, 'import-sjs'))
    .replace(ELSE_ATTRIBUTE_RE, ' a:else')
}

export function transformTemplateForAlipay(source: string) {
  return rewriteAlipayReferenceExtensions(
    normalizeImportSjsAttributes(
      rewriteTemplateImportExtensionsForAlipay(
        rewriteAlipayTemplateSyntax(source),
      ),
    ),
  )
}
