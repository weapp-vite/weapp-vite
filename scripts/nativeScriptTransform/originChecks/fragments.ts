import type * as t from '@babel/types'
import type { InlineOriginFragment, InlineOriginOccurrence } from '../origins/types'
import type { CheckedAsset } from './shared'
import { isDeepStrictEqual } from 'node:util'
import { ensure, expression, object, semantics } from './shared'

/** 独立解析后的参数仅接受直接基本字面量；复杂表达式不产生部分覆盖。 */
export function primitiveArguments(node: t.Node) {
  ensure(node.type === 'CallExpression' && !node.typeArguments, 'unsupported fragment call')
  ensure(node.arguments.length > 0, 'empty fragment argument coverage')
  return node.arguments.map((argument) => {
    ensure(argument.type === 'StringLiteral' || argument.type === 'NumericLiteral'
      || argument.type === 'BooleanLiteral' || argument.type === 'NullLiteral', 'unsupported fragment argument')
    return argument
  })
}

function range(raw: unknown, content: string) {
  const value = object(raw)
  ensure(Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end)
    && (value.start as number) >= 0 && (value.end as number) > (value.start as number)
    && (value.end as number) <= content.length && typeof value.text === 'string'
    && content.slice(value.start as number, value.end as number) === value.text, 'invalid fragment span or spelling')
  return value as { start: number, end: number, text: string }
}

/** 以同序 AST 参数核对来源与资产坐标，不用相同文本猜测 token 的归属。 */
export function validateFragments(raw: unknown, owner: InlineOriginOccurrence['expression'], asset: CheckedAsset, content: string) {
  ensure(Array.isArray(raw), 'fragment evidence is not an array')
  range(owner, content)
  const original = primitiveArguments(expression(owner.text))
  const generated = primitiveArguments(asset.node)
  ensure(raw.length === original.length && generated.length === original.length, 'fragment argument coverage differs')
  return raw.map((value, index) => {
    const fragment = object(value)
    ensure(fragment.kind === 'inline-handler-argument-literal' && fragment.role === 'copied', 'unsupported fragment contract')
    const source = range(fragment.source, content)
    const target = range(fragment.generated, asset.expression)
    const sourceNode = original[index]!
    const targetNode = generated[index]!
    ensure(source.start === owner.start + sourceNode.start! && source.end === owner.start + sourceNode.end!
      && target.start === targetNode.start && target.end === targetNode.end, 'fragment does not own its argument token')
    ensure(source.text === target.text && isDeepStrictEqual(semantics(sourceNode), semantics(targetNode)), 'copied fragment value or spelling differs')
    return { fragment: fragment as unknown as InlineOriginFragment, index }
  })
}
