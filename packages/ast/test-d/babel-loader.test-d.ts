import type * as BabelCore from '@babel/core'
import type { NodePath, TransformOptions } from '@weapp-vite/ast/babelCore'
import type { SourceMapConverter } from 'convert-source-map'
import babelCore, { parseSync, transformAsync, transformSync, types } from '@weapp-vite/ast/babelCore'
import { createBabelBackendLoader } from '@weapp-vite/ast/babelLoader'
import { expectAssignable, expectError, expectType } from 'tsd'

const loadBackend = createBabelBackendLoader(async () => ({ transform: transformSync }))
expectType<() => Promise<{ transform: typeof BabelCore.transformSync }>>(loadBackend)
expectType<Promise<{ transform: typeof BabelCore.transformSync }>>(loadBackend())
expectError(createBabelBackendLoader(Promise.resolve({})))
expectError(createBabelBackendLoader(() => ({})))
expectType<typeof BabelCore>(babelCore)
expectType<typeof BabelCore.parseSync>(parseSync)
expectType<typeof BabelCore.transformAsync>(transformAsync)
expectType<typeof BabelCore.transformSync>(transformSync)
expectType<typeof BabelCore.types>(types)
expectAssignable<BabelCore.InputOptions>({ sourceMaps: true } as TransformOptions)
expectAssignable<BabelCore.NodePath>({} as NodePath)

declare const file: InstanceType<typeof babelCore.File>
expectType<SourceMapConverter | null>(file.inputMap)
