import { getMiniProgramDirectivePrefix, getSupportedMiniProgramPlatforms } from '@weapp-core/shared'

const CONTROL_ATTR_SUFFIXES = [
  'if',
  'elif',
  'else',
  'for',
  'for-item',
  'for-index',
  'key',
] as const

export type ControlAttrSuffix = typeof CONTROL_ATTR_SUFFIXES[number]

export const CONTROL_ATTR_PREFIXES = Array.from(new Set(
  getSupportedMiniProgramPlatforms().map(platform => getMiniProgramDirectivePrefix(platform)),
))

export const TEMPLATE_IMPORT_TAG_NAMES = Array.from(new Set([
  'import',
  ...CONTROL_ATTR_PREFIXES.map(prefix => `${prefix}-import`),
]))

export const TEMPLATE_INCLUDE_TAG_NAMES = Array.from(new Set([
  'include',
  ...CONTROL_ATTR_PREFIXES.map(prefix => `${prefix}-include`),
]))

export const CONTROL_ATTRS = new Set([
  ...CONTROL_ATTR_PREFIXES.flatMap(prefix => CONTROL_ATTR_SUFFIXES.map(suffix => `${prefix}:${suffix}`)),
])

export const EVENT_PREFIX_RE = /^(?:bind|catch|mut-bind|capture-bind|capture-catch)([\w-]+)$/
export const EVENT_KIND_ALIAS: Record<string, string> = {
  tap: 'click',
}

export const SELF_CLOSING_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'image',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

export function resolveControlAttributeName(
  attribs: Record<string, string>,
  suffix: ControlAttrSuffix,
): string | undefined {
  for (const prefix of CONTROL_ATTR_PREFIXES) {
    const name = `${prefix}:${suffix}`
    if (name in attribs) {
      return name
    }
  }
  return undefined
}

export function resolveControlAttributeValue(
  attribs: Record<string, string>,
  suffix: ControlAttrSuffix,
): string | undefined {
  const name = resolveControlAttributeName(attribs, suffix)
  return name ? attribs[name] : undefined
}

export function hasControlAttribute(
  attribs: Record<string, string>,
  suffix: ControlAttrSuffix,
): boolean {
  return resolveControlAttributeName(attribs, suffix) !== undefined
}

export function normalizeTagName(name: string) {
  switch (name) {
    case 'view':
    case 'cover-view':
    case 'navigator':
    case 'scroll-view':
    case 'swiper':
    case 'swiper-item':
    case 'movable-area':
    case 'movable-view':
    case 'cover-image':
      return 'div'
    case 'text':
    case 'icon':
      return 'span'
    case 'image':
      return 'img'
    case 'button':
      return 'weapp-button'
    case 'input':
      return 'input'
    case 'textarea':
      return 'textarea'
    case 'form':
      return 'form'
    case 'label':
      return 'label'
    case 'picker':
    case 'picker-view':
      return 'select'
    case 'block':
      return '#fragment'
    case 'slot':
      return 'slot'
    default:
      return name || 'div'
  }
}

export function normalizeAttributeName(name: string) {
  if (name === 'class' || name === 'style' || name.startsWith('data-')) {
    return name
  }
  if (name === 'hover-class') {
    return 'data-hover-class'
  }
  return name.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}
