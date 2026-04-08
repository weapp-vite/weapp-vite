const TEMPLATE_IMPORT_RE = /\.(?:wxml|html)$/i
const TEMPLATE_IMPORT_TAG_NAMES = ['import', 'include'] as const
const TEMPLATE_IMPORT_ATTRS = Object.freeze({
  import: ['src'],
  include: ['src'],
} satisfies Readonly<Record<string, readonly string[]>>)

type TemplateImportTagName = keyof typeof TEMPLATE_IMPORT_ATTRS

export function getTemplateImportTagNames() {
  return [...TEMPLATE_IMPORT_TAG_NAMES]
}

export function isTemplateImportTag(tagName?: string) {
  return typeof tagName === 'string' && TEMPLATE_IMPORT_TAG_NAMES.includes(tagName as TemplateImportTagName)
}

export function getTemplateImportAttrs(tagName?: string) {
  if (!tagName) {
    return undefined
  }
  if (!(tagName in TEMPLATE_IMPORT_ATTRS)) {
    return undefined
  }
  return TEMPLATE_IMPORT_ATTRS[tagName as TemplateImportTagName]
}

export function isTemplateImportAttr(tagName: string | undefined, attrName: string) {
  if (!tagName) {
    return false
  }
  return getTemplateImportAttrs(tagName)?.includes(attrName) === true
}

export function shouldNormalizeTemplateImportSource(value: string) {
  return TEMPLATE_IMPORT_RE.test(value)
}

export function isImportTag(tagName?: string) {
  return isTemplateImportTag(tagName)
}

export interface Token {
  start: number
  end: number
  value: string
}
