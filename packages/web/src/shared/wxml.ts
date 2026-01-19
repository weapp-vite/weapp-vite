export const CONTROL_ATTRS = new Set([
  'wx:if',
  'wx:elif',
  'wx:else',
  'wx:for',
  'wx:for-item',
  'wx:for-index',
  'wx:key',
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
      return 'button'
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
