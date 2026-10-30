import type { MiniProgramPlatformDescriptor } from '@weapp-core/shared'
import { getMiniProgramScriptModuleOptions } from '@weapp-core/shared'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

const options = getMiniProgramScriptModuleOptions('tt', 'sjs')
expectType<'commonjs' | 'esm'>(options.format)
expectType<'src' | 'from'>(options.sourceAttribute)
expectType<'module' | 'name'>(options.moduleAttribute)
expectAssignable<NonNullable<MiniProgramPlatformDescriptor['scriptModule']>>({ format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' })
expectNotAssignable<MiniProgramPlatformDescriptor['scriptModule']>({ format: 'unknown', sourceAttribute: 'src', moduleAttribute: 'module' })
