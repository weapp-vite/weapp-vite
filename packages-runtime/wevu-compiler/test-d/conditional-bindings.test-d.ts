import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { BindingCondition, ClassStyleBinding } from '@wevu/compiler'
import { expectAssignable, expectType } from 'tsd'

declare const source: Expression
declare const binding: ClassStyleBinding
declare const condition: BindingCondition

expectType<BindingCondition[] | undefined>(binding.conditions)
expectType<Expression | undefined>(condition.rawExpAst)
expectAssignable<BindingCondition>({ expAst: source, forDepth: 1 })
expectAssignable<ClassStyleBinding>({ name: 'title', type: 'bind', exp: 'format(item)', forStack: [] })
expectAssignable<ClassStyleBinding>({
  name: 'title',
  type: 'bind',
  exp: 'format(item)',
  forStack: [],
  conditions: [{ expAst: source, forDepth: 0 }],
})
