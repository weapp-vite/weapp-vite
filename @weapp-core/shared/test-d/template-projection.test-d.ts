import type { MiniProgramNativeScriptModule, MiniProgramTemplateProjection } from '@weapp-core/shared'
import { getMiniProgramTemplateProjection } from '@weapp-core/shared'
import { expectError, expectType } from 'tsd'

const projection = getMiniProgramTemplateProjection('jd')
expectType<MiniProgramTemplateProjection>(projection)
expectType<'legacy' | 'xml'>(projection.syntax)
expectType<readonly string[]>(projection.compatibilityRawTags)
expectType<MiniProgramNativeScriptModule>(projection.portableScriptModule)
expectType<readonly MiniProgramNativeScriptModule[]>(projection.nativeScriptModules)
expectType<':' | '-'>(projection.directiveSeparator)
expectError(getMiniProgramTemplateProjection('qq'))
expectError(getMiniProgramTemplateProjection('unknown'))
