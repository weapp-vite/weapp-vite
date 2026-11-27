import type { MiniProgramRuntimeCapabilities, MiniProgramRuntimeDescriptor, MpPlatform } from '@weapp-core/shared/platforms/runtime'
import { getMiniProgramDirectivePrefix, getMiniProgramRuntimeCapabilities, getMiniProgramRuntimeDescriptor, getMiniProgramRuntimeGlobalKeys, getSupportedMiniProgramDirectivePrefixes, resolveMiniProgramPlatform, supportsMiniProgramRuntimeCapability } from '@weapp-core/shared/platforms/runtime'
import { MINI_PROGRAM_RUNTIME_GLOBAL_KEYS, WEAPP_RUNTIME_GLOBAL_KEY, XHS_RUNTIME_GLOBAL_KEY } from '@weapp-core/shared/platforms/runtime/global-keys'
import { expectError, expectType } from 'tsd'

expectType<MpPlatform | undefined>(resolveMiniProgramPlatform('wx'))
expectType<MiniProgramRuntimeDescriptor>(getMiniProgramRuntimeDescriptor('alipay'))
expectType<MiniProgramRuntimeCapabilities>(getMiniProgramRuntimeCapabilities('tt'))
expectType<readonly string[]>(getMiniProgramRuntimeGlobalKeys())
expectType<readonly string[]>(MINI_PROGRAM_RUNTIME_GLOBAL_KEYS)
expectType<'wx'>(WEAPP_RUNTIME_GLOBAL_KEY)
expectType<'xhs'>(XHS_RUNTIME_GLOBAL_KEY)
expectType<boolean>(supportsMiniProgramRuntimeCapability('weapp', 'pageShareMenu'))
expectType<string>(getMiniProgramDirectivePrefix('alipay'))
expectType<readonly string[]>(getSupportedMiniProgramDirectivePrefixes())
expectError(getMiniProgramRuntimeDescriptor('native-app'))
expectError(getMiniProgramDirectivePrefix('native-app'))
expectError(supportsMiniProgramRuntimeCapability('weapp', 'unknownCapability'))
