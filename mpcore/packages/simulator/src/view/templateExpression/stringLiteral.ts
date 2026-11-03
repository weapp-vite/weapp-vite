interface StringLiteralNode {
  readonly value?: unknown
  readonly extra?: { readonly raw?: unknown }
}

const literalValues = new WeakMap<object, string>()

function decodeObservedLiteral(raw: string) {
  const quote = raw[0]
  if ((quote !== '\'' && quote !== '"') || raw.at(-1) !== quote) {
    return undefined
  }
  let value = ''
  for (let index = 1; index < raw.length - 1; index++) {
    const character = raw[index]!
    if (character !== '\\') {
      value += character
      continue
    }
    const escaped = raw[++index]
    if (escaped === '\\') {
      value += '\\'
    }
    else if (escaped === quote) {
      value += quote === '\'' ? '\\x27' : '\\x22'
    }
    else {
      return undefined
    }
  }
  return value
}

/** 仅消费真实 WXML 已确认的引号与反斜杠规则；其他转义整段沿用 Babel 值，尚不声明宿主兼容。 */
export function resolveWxmlStringLiteral(node: StringLiteralNode) {
  if (typeof node.value !== 'string') {
    return node.value
  }
  const cached = literalValues.get(node)
  if (cached !== undefined) {
    return cached
  }
  const raw = node.extra?.raw
  const value = typeof raw === 'string' ? decodeObservedLiteral(raw) ?? node.value : node.value
  literalValues.set(node, value)
  return value
}
