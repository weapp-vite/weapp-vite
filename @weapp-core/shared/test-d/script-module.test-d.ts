import type { MiniProgramNativeScriptModule, MiniProgramPlatformDescriptor } from '@weapp-core/shared'
import { getMiniProgramNativeScriptModules, getMiniProgramScriptModuleOptions } from '@weapp-core/shared'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

const options = getMiniProgramScriptModuleOptions('tt', 'sjs')
expectType<'commonjs' | 'esm'>(options.format)
expectType<'src' | 'from'>(options.sourceAttribute)
expectType<'module' | 'name'>(options.moduleAttribute)
expectAssignable<NonNullable<MiniProgramPlatformDescriptor['scriptModule']>>({ format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' })
expectNotAssignable<MiniProgramPlatformDescriptor['scriptModule']>({ format: 'unknown', sourceAttribute: 'src', moduleAttribute: 'module' })
expectType<readonly MiniProgramNativeScriptModule[]>(getMiniProgramNativeScriptModules('jd'))
expectType<readonly MiniProgramNativeScriptModule[]>(getMiniProgramNativeScriptModules())
expectType<string>(getMiniProgramScriptModuleOptions('jd', 'jds').tag)
expectAssignable<MiniProgramPlatformDescriptor['nativeScriptModules']>([{ extension: 'jds', tag: 'jds', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' }])
expectNotAssignable<MiniProgramNativeScriptModule>({ extension: 'jds', tag: 'jds', format: 'unknown', sourceAttribute: 'src', moduleAttribute: 'module' })
