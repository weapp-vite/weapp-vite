import type { Attribute, AttributeValue, Syntax } from './types'
import { decodeAttribute } from './decode'
import { expressionEnd } from './expression'
import { TemplateLexicalError } from './lexical'

export type CanonicalAttribute = Pick<Attribute, 'name' | 'value' | 'quote'>

/** 显式表达式只能占据一个完整绑定，不能提前结束后混入文本或模板结构。 */
export function assertExpressionBoundary(source: string, syntax: Syntax, quote?: string) {
  try {
    if (expressionEnd(source, 0, true, syntax, quote) !== source.length) {
      throw new TypeError('Invalid WXML expression: expected a single complete interpolation.')
    }
  }
  catch (error) {
    if (!(error instanceof TemplateLexicalError)) {
      throw error
    }
    throw new TypeError(`Invalid WXML expression: ${error.message}`)
  }
}

function encodeAttributeLayer(value: string, syntax: Syntax) {
  return syntax === 'legacy'
    ? value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    : value.replace(/"/g, '&quot;')
}

function encodeEntities(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 字面量显式拆开绑定定界符，表达式则保留独立的输入语义。 */
export function encodeAttribute(value: AttributeValue, syntax: Syntax) {
  if (typeof value === 'string') {
    return encodeAttributeLayer(encodeEntities(value), syntax).replace(/\{\{/g, '{{\'{\'}}{{\'{\'}}')
  }
  let expression: string
  if (typeof value === 'number' && Number.isFinite(value)) {
    expression = String(value)
  }
  else if (typeof value === 'boolean') {
    expression = String(value)
  }
  else if (value && typeof value === 'object' && typeof value.expression === 'string' && value.expression.trim()) {
    expression = value.expression
  }
  else {
    throw new TypeError('Expected a string, finite number, boolean, or nonempty expression.')
  }
  const encoded = syntax === 'legacy'
    ? encodeAttributeLayer(expression, syntax)
    : encodeEntities(expression).replace(/"/g, '&quot;')
  return `{{${encoded}}}`
}

/** 文本字面量不能生成标签或意外触发绑定。 */
export function encodeText(value: string | { readonly expression: string }) {
  if (typeof value === 'string') {
    return encodeEntities(value).replace(/\{\{/g, '{{\'{\'}}{{\'{\'}}')
  }
  if (value && typeof value.expression === 'string' && value.expression.trim()) {
    return `{{${value.expression}}}`
  }
  throw new TypeError('Expected a string or nonempty expression.')
}

/** 只转换属性外层引号，不重复编码实体或将绑定当作字符串。 */
export function canonicalAttribute(attribute: CanonicalAttribute, syntax: Syntax) {
  if (attribute.value === undefined) {
    return attribute.name
  }
  let value = attribute.value
  if (syntax === 'xml') {
    value = value.replace(/"/g, '&quot;')
  }
  else if (attribute.quote !== '"') {
    value = encodeAttributeLayer(decodeAttribute(value, syntax, false, attribute.quote), syntax)
  }
  return `${attribute.name}="${value}"`
}
