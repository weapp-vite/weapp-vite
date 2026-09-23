import type { MiniProgramRuntimeCapabilities, MiniProgramRuntimeDescriptor, MpPlatform } from '@weapp-core/shared/platforms/runtime'
import { getMiniProgramDirectivePrefix, getMiniProgramRuntimeCapabilities, getMiniProgramRuntimeDescriptor, getMiniProgramRuntimeGlobalKeys, getSupportedMiniProgramDirectivePrefixes, resolveMiniProgramPlatform, supportsMiniProgramRuntimeCapability } from '@weapp-core/shared/platforms/runtime'
import { expectError, expectType } from 'tsd'

expectType<MpPlatform | undefined>(resolveMiniProgramPlatform('wx'))
expectType<MiniProgramRuntimeDescriptor>(getMiniProgramRuntimeDescriptor('alipay'))
expectType<MiniProgramRuntimeCapabilities>(getMiniProgramRuntimeCapabilities('tt'))
expectType<readonly string[]>(getMiniProgramRuntimeGlobalKeys())
expectType<boolean>(supportsMiniProgramRuntimeCapability('weapp', 'pageShareMenu'))
expectType<string>(getMiniProgramDirectivePrefix('alipay'))
expectType<readonly string[]>(getSupportedMiniProgramDirectivePrefixes())
expectError(getMiniProgramRuntimeDescriptor('native-app'))
expectError(getMiniProgramDirectivePrefix('native-app'))
expectError(supportsMiniProgramRuntimeCapability('weapp', 'unknownCapability'))
