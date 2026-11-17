export interface RichTextSourceNode {
  type?: string
  name?: string
  attrs?: Record<string, unknown>
  children?: RichTextSourceNode[]
  text?: string
}

export type SafeRichTextNode
  = | { type: 'text', text: string }
    | { type: 'element', name: string, attrs: Record<string, string>, children: SafeRichTextNode[] }

export const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'big',
  'blockquote',
  'br',
  'caption',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'div',
  'dl',
  'dt',
  'em',
  'fieldset',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'ins',
  'label',
  'legend',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  'rt',
  'ruby',
  's',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'tt',
  'u',
  'ul',
])

const ALLOWED_STYLE_PROPERTIES = new Set([
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-color',
  'border-left',
  'border-radius',
  'border-right',
  'border-style',
  'border-top',
  'border-width',
  'color',
  'display',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'letter-spacing',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'opacity',
  'overflow',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'text-indent',
  'text-overflow',
  'text-transform',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
  'word-wrap',
])

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isSafeUrl(value: string, attribute: string) {
  const normalized = Array.from(value)
    .filter(character => character.charCodeAt(0) > 0x20)
    .join('')
    .toLowerCase()
  if (!normalized || normalized.startsWith('#') || normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) {
    return true
  }
  if (/^(?:https?:|mailto:|tel:)/.test(normalized)) {
    return true
  }
  return attribute === 'src' && /^data:image\/(?:gif|jpe?g|png|webp);base64,/.test(normalized)
}

function isSafeStyleValue(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, '')
  return !normalized.includes('url(')
    && !normalized.includes('expression(')
    && !normalized.includes('javascript:')
    && !normalized.includes('behavior:')
    && !normalized.includes('-moz-binding')
}

export function sanitizeRichTextStyle(value: unknown) {
  const source = isRecord(value)
    ? Object.entries(value)
        .map(([property, propertyValue]) => `${property}:${String(propertyValue)}`)
        .join(';')
    : String(value ?? '')
  const declarations: string[] = []
  for (const declaration of source.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator <= 0) {
      continue
    }
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const propertyValue = declaration.slice(separator + 1).trim()
    if (ALLOWED_STYLE_PROPERTIES.has(property) && propertyValue && isSafeStyleValue(propertyValue)) {
      declarations.push(`${property}: ${propertyValue}`)
    }
  }
  return declarations.join('; ')
}
