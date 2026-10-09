import type { MiniProgramPlatform, TemplateCompileOptions } from '@wevu/compiler'
import { getMiniProgramTemplatePlatform } from '@wevu/compiler'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

const wechat = getMiniProgramTemplatePlatform('weapp')
expectType<boolean | undefined>(wechat.nativeSlotContext)
expectAssignable<MiniProgramPlatform>({ ...wechat, nativeSlotContext: false })
expectAssignable<TemplateCompileOptions>({ platform: { ...wechat, nativeSlotContext: false }, scopedSlotsRequireProps: true })
expectNotAssignable<MiniProgramPlatform>({ ...wechat, nativeSlotContext: 'false' })
