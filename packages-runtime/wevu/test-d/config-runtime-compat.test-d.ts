import type { Ref as VueRef } from 'vue'
import type { ComputedDefinitions, DefineComponentOptions, MethodDefinitions, PageFeatures, PageLayoutMeta, Ref, SetDataSnapshotOptions, WevuDefaults } from 'wevu'
import type { PageFeatures as ConfigPageFeatures, PageLayoutMeta as ConfigPageLayoutMeta, WevuConfigComponentOptions } from 'wevu/config'
import type { ComputedDefinitions as PureComputedDefinitions, MethodDefinitions as PureMethodDefinitions, Ref as PureRef } from 'wevu/types'
import { expectAssignable, expectType } from 'tsd'
import { setWevuDefaults } from 'wevu'

expectType<ComputedDefinitions>({} as PureComputedDefinitions)
expectType<MethodDefinitions>({} as PureMethodDefinitions)
expectType<PageLayoutMeta>({} as ConfigPageLayoutMeta)
expectType<PageFeatures>({} as ConfigPageFeatures)
expectType<Ref<number, number | string>>({} as PureRef<number, number | string>)
expectType<VueRef<number, number | string>>({} as PureRef<number, number | string>)
expectType<Omit<WechatMiniprogram.Component.ComponentOptions, 'pureDataPattern'>>({} as Omit<WevuConfigComponentOptions, 'pureDataPattern'>)
expectType<Omit<WevuConfigComponentOptions, 'pureDataPattern'>>({} as Omit<WechatMiniprogram.Component.ComponentOptions, 'pureDataPattern'>)

type RuntimeComponentDefaults = NonNullable<WevuDefaults['component']>
expectType<Partial<DefineComponentOptions<any, any, any, any>> | undefined>({} as WevuDefaults['component'])
expectAssignable<RuntimeComponentDefaults['data']>(() => ({ count: 0 }))
expectAssignable<RuntimeComponentDefaults['options']>({ pureDataPattern: /^_/ })
expectAssignable<RuntimeComponentDefaults['setData']>({
  debug(info) {
    expectType<'patch' | 'diff'>(info.mode)
  },
})
declare const defaults: WevuDefaults
expectType<void>(setWevuDefaults(defaults))
expectAssignable<SetDataSnapshotOptions>({
  debug(info) {
    expectType<number>(info.payloadKeys)
  },
})
