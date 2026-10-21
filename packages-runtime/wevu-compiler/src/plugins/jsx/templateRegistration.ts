import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { ClassStyleBinding, ForParseResult, InlineExpressionAsset } from '../vue/compiler/template/types'
import type { JsxDynamicIslandMetadata } from './compileJsx/types'
import { createHash } from 'node:crypto'
import { generate } from '../../utils/babel'

function printExpression(expression: Expression | undefined) {
  return expression && generate(expression, { compact: true }).code
}

function serializeForScope(scope: ForParseResult) {
  const { listExpAst, rawListExpAst, projectedListExpAst, ...values } = scope
  return {
    ...values,
    listExpression: printExpression(listExpAst),
    rawListExpression: printExpression(rawListExpAst),
    projectedListExpression: printExpression(projectedListExpAst),
  }
}

/** 只记录编译器注册语义，不把用户方法、源码位置或样式混入模板能力边界。 */
export function createJsxTemplateRegistrationSignature(options: {
  template: string | undefined
  inlineExpressions: InlineExpressionAsset[]
  classStyleBindings: ClassStyleBinding[]
  dynamicIslands: JsxDynamicIslandMetadata[] | undefined
}): string {
  const bindings = options.classStyleBindings.map(({ expAst, forStack, conditions, ...binding }) => ({
    ...binding,
    expression: printExpression(expAst),
    forStack: forStack.map(serializeForScope),
    conditions: conditions?.map(condition => ({
      expression: printExpression(condition.expAst),
      rawExpression: printExpression(condition.rawExpAst),
      forDepth: condition.forDepth,
    })),
  }))
  return createHash('sha256').update(JSON.stringify([
    options.template,
    options.inlineExpressions,
    bindings,
    options.dynamicIslands,
  ])).digest('hex')
}
