import type { WxmlAttributeValue, WxmlSourceLocation } from '../../types'
import type { WxmlSyntax } from '../template/lexical'

/** 字符串按宿主属性词法编码；拆开字面量定界符，避免触发用户输入的绑定。 */
export function encodeAttribute(value: WxmlAttributeValue, syntax: WxmlSyntax) {
  if (typeof value === 'string') {
    const literal = syntax === 'legacy'
      ? value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      : value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    return literal.replace(/\{\{/g, '{{\'{\'}}{{\'{\'}}')
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
  return syntax === 'legacy'
    ? `{{${expression.replace(/"/g, '\\"')}}}`
    : `{{${expression.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}}}`
}

/** 行索引只建立一次，避免大量节点定位退化为反复扫描整份源码。 */
export function createLocator(code: string) {
  const starts = [0]
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\r' || code[i] === '\n') {
      if (code[i] === '\r' && code[i + 1] === '\n') {
        i++
      }
      starts.push(i + 1)
    }
  }
  return (offset: number): WxmlSourceLocation => {
    let low = 0
    let high = starts.length
    while (low + 1 < high) {
      const mid = (low + high) >>> 1
      if (starts[mid]! <= offset) {
        low = mid
      }
      else {
        high = mid
      }
    }
    return Object.freeze({ offset, line: low + 1, column: offset - starts[low]! + 1 })
  }
}
