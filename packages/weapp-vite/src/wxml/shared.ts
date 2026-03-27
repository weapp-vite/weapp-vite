const TEMPLATE_IMPORT_RE = /\.(?:wxml|html)$/i
const TEMPLATE_IMPORT_TAG_NAMES = ['import', 'include'] as const
const TEMPLATE_IMPORT_ATTRS = Object.freeze({
  import: ['src'],
  include: ['src'],
} satisfies Readonly<Record<string, readonly string[]>>)

export function getTemplateImportTagNames() {
  return [...TEMPLATE_IMPORT_TAG_NAMES]
}

export function isTemplateImportTag(tagName?: string) {
  return typeof tagName === 'string' && getTemplateImportTagNames().includes(tagName)
}

export function getTemplateImportAttrs(tagName?: string) {
  if (!tagName) {
    return undefined
  }
  return TEMPLATE_IMPORT_ATTRS[tagName]
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
