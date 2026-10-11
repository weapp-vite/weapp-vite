import type { NodePath as CoreNodePath, InputOptions } from '@babel/core'
import type * as Core from '@babel/core'
import type { Identifier } from '@babel/types'
import type { NodePath, TransformOptions } from '@weapp-vite/ast/babelCore'
import babelCore, * as adapter from '@weapp-vite/ast/babelCore'
import { expectError, expectType } from 'tsd'

expectType<typeof Core>(babelCore)
expectType<typeof Core.parse>(adapter.parse)
expectType<typeof Core.parseAsync>(adapter.parseAsync)
expectType<typeof Core.parseSync>(adapter.parseSync)
expectType<typeof Core.transform>(adapter.transform)
expectType<typeof Core.transformAsync>(adapter.transformAsync)
expectType<typeof Core.transformSync>(adapter.transformSync)
expectType<typeof Core.transformFile>(adapter.transformFile)
expectType<typeof Core.transformFileAsync>(adapter.transformFileAsync)
expectType<typeof Core.transformFileSync>(adapter.transformFileSync)
expectType<typeof Core.transformFromAst>(adapter.transformFromAst)
expectType<typeof Core.transformFromAstAsync>(adapter.transformFromAstAsync)
expectType<typeof Core.transformFromAstSync>(adapter.transformFromAstSync)
expectType<typeof Core.types>(adapter.types)
expectType<typeof Core.version>(adapter.version)
expectType<typeof Core.loadPartialConfigSync>(babelCore.loadPartialConfigSync)
expectType<InputOptions>({} as TransformOptions)
expectType<TransformOptions>({} as InputOptions)
expectType<CoreNodePath<Identifier>>({} as NodePath<Identifier>)
expectType<NodePath<Identifier>>({} as CoreNodePath<Identifier>)
expectError(adapter.parseSync(42))
expectError(adapter.transformSync('const answer = 42', { babelrc: 'invalid' }))
