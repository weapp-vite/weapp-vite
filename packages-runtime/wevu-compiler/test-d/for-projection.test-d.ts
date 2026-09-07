import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { ForParseResult } from '@wevu/compiler'
import { expectAssignable, expectType } from 'tsd'

declare const source: Expression
declare const forInfo: ForParseResult

expectType<Expression | undefined>(forInfo.rawListExpAst)
expectType<Expression | undefined>(forInfo.listExpAst)
expectType<Expression | undefined>(forInfo.projectedListExpAst)
expectAssignable<ForParseResult>({ item: 'item', listExp: 'items', listExpAst: source })
expectAssignable<ForParseResult>({ item: 'item', listExp: 'items', rawListExpAst: source, listExpAst: source })
