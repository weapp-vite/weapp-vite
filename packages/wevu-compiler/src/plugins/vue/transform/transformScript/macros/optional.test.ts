import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { stripOptionalFlag, stripOptionalFromPattern } from './optional'

describe('transformScript optional macro helpers', () => {
  it('strips optional flag from supported nodes', () => {
    const id = t.identifier('foo') as t.Identifier & { optional?: boolean }
    id.optional = true

    expect(stripOptionalFlag(id)).toBe(true)
    expect(id.optional).toBe(false)
    expect(stripOptionalFlag(id)).toBe(false)
    expect(stripOptionalFlag(undefined)).toBe(false)
  })

  it('strips optional recursively for assignment/object/array/rest patterns', () => {
    const objectId = t.identifier('obj') as t.Identifier & { optional?: boolean }
    objectId.optional = true
    const restId = t.identifier('rest') as t.Identifier & { optional?: boolean }
    restId.optional = true
    const nestedId = t.identifier('nested') as t.Identifier & { optional?: boolean }
    nestedId.optional = true

    const pattern = t.assignmentPattern(
      t.objectPattern([
        t.objectProperty(t.identifier('obj'), objectId),
        t.objectProperty(
          t.identifier('arr'),
          t.arrayPattern([
            nestedId,
            t.assignmentPattern(
              t.identifier('withDefault'),
              t.numericLiteral(1),
            ),
          ]),
        ),
        t.restElement(restId),
      ]),
      t.objectExpression([]),
    )
    ;(pattern as any).optional = true
    ;((pattern.left as any) as { optional?: boolean }).optional = true
    ;(((pattern.left as t.ObjectPattern).properties[1] as t.ObjectProperty).value as t.ArrayPattern).optional = true

    const changed = stripOptionalFromPattern(pattern)
    expect(changed).toBe(true)
    expect((pattern as any).optional).toBe(false)
    expect((pattern.left as any).optional).toBe(false)
    expect(objectId.optional).toBe(false)
    expect(restId.optional).toBe(false)
    expect(nestedId.optional).toBe(false)
  })

  it('handles TS parameter property and void pattern', () => {
    const tsId = t.identifier('arg') as t.Identifier & { optional?: boolean }
    tsId.optional = true
    const tsParam = t.tsParameterProperty(tsId)
    expect(stripOptionalFromPattern(tsParam)).toBe(true)
    expect(tsId.optional).toBe(false)

    const voidPattern = t.voidPattern() as t.VoidPattern & { optional?: boolean }
    voidPattern.optional = true
    expect(stripOptionalFromPattern(voidPattern as any)).toBe(false)
    expect(voidPattern.optional).toBe(true)
  })

  it('returns false for empty or unsupported patterns', () => {
    expect(stripOptionalFromPattern(null)).toBe(false)
    expect(stripOptionalFromPattern(undefined)).toBe(false)
    expect(stripOptionalFromPattern(t.stringLiteral('x') as any)).toBe(false)
  })
})
