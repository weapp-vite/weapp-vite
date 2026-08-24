import * as t from '@weapp-vite/ast/babelTypes'

const DIGIT_NUMERIC_SEPARATOR_RE = /\d_\d/
const NON_DECIMAL_NUMERIC_LITERAL_RE = /\b0[bxo][\da-f_]/i
const DECIMAL_BIGINT_LITERAL_RE = /\b\d[\d_]*n\b/
const NON_DECIMAL_NUMERIC_RAW_RE = /^0[bxo]/i

export function hasExtendedNumericLiteralSyntax(exp: string): boolean {
  return DIGIT_NUMERIC_SEPARATOR_RE.test(exp)
    || NON_DECIMAL_NUMERIC_LITERAL_RE.test(exp)
    || DECIMAL_BIGINT_LITERAL_RE.test(exp)
}

function serializeBigIntForWxml(value: bigint): t.Expression {
  const asNumber = Number(value)
  if (!Number.isSafeInteger(asNumber)) {
    return t.stringLiteral(value.toString())
  }
  return asNumber < 0
    ? t.unaryExpression('-', t.numericLiteral(Math.abs(asNumber)))
    : t.numericLiteral(asNumber)
}

export function normalizeTopLevelBigInt(expression: t.Expression): t.Expression {
  if (t.isBigIntLiteral(expression)) {
    return serializeBigIntForWxml(BigInt(expression.value))
  }
  if (
    t.isUnaryExpression(expression, { operator: '-' })
    && t.isBigIntLiteral(expression.argument)
  ) {
    return serializeBigIntForWxml(-BigInt(expression.argument.value))
  }
  return expression
}

export function canonicalizeNumericLiteral(node: t.NumericLiteral): void {
  const raw = node.extra?.raw
  if (typeof raw !== 'string' || (!raw.includes('_') && !NON_DECIMAL_NUMERIC_RAW_RE.test(raw))) {
    return
  }
  delete node.extra?.raw
  delete node.extra?.rawValue
}
