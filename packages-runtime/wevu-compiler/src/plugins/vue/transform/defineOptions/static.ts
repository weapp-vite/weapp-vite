import * as t from '@weapp-vite/ast/babelTypes'
import { resolveStaticLiteralValue } from '../jsonMacros/static'

export interface DefineOptionsStatementLike {
  argPath?: {
    node?: unknown
  }
}

export function resolveStaticDefineOptionsValues(statements: DefineOptionsStatementLike[]) {
  const values: unknown[] = []
  for (const statement of statements) {
    const arg = statement.argPath?.node
    if (!arg || !t.isExpression(arg)) {
      return undefined
    }
    let value: unknown
    try {
      value = resolveStaticLiteralValue(arg)
    }
    catch {
      return undefined
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    values.push(value)
  }
  return values
}
