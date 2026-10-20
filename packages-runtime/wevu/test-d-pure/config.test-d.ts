import type { PageLayoutMeta, WevuConfigDefaults, WevuConfigSetDataOptions } from 'wevu/config'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

expectAssignable<WevuConfigDefaults>({
  app: { data: { count: 0 }, globalData: { title: 'demo' }, setData: { strategy: 'patch', debugPhases: true } },
  component: {
    data: { rows: [{ id: 1 }], selected: null },
    allowNullPropInput: true,
    allowFunctionProps: 'auto',
    setupLifecycle: 'attached',
    features: { enableOnPageScroll: true },
    externalClasses: ['custom-class'],
    props: ['title'],
    properties: { disabled: { value: false } },
    behaviors: ['wx://form-field'],
    options: { virtualHost: true, multipleSlots: true, addGlobalClass: false, styleIsolation: 'shared' },
    setData: { strategy: 'patch', highFrequencyWarning: { enabled: true, maxCalls: 30 }, pick: ['rows'] },
    custom: { enabled: true, values: [1, 'value', false, null] },
  },
})
expectAssignable<PageLayoutMeta>(false)
expectAssignable<PageLayoutMeta>({ name: 'shell', props: { title: 'demo' } })
expectNotAssignable<WevuConfigDefaults>({ component: { setup: () => ({}) } })
expectNotAssignable<WevuConfigDefaults>({ component: { created() {} } })
expectNotAssignable<WevuConfigDefaults>({ component: { data: () => ({ count: 0 }) } })
expectNotAssignable<WevuConfigDefaults>({ component: { options: { pureDataPattern: /^_/ } } })
expectNotAssignable<WevuConfigDefaults>({ component: { options: { styleIsolation: 'invalid' } } })
expectNotAssignable<WevuConfigDefaults>({ component: { setData: { strategy: 'invalid' } } })
expectNotAssignable<WevuConfigDefaults>({ component: { setData: { debug: () => {} } } })
expectNotAssignable<WevuConfigDefaults>({ component: { features: { enableOnPageScroll: 'yes' } } })
expectNotAssignable<WevuConfigDefaults>({ component: { allowNullPropInput: 'yes' } })
expectNotAssignable<WevuConfigDefaults>({ component: { custom: new Date() } })
expectNotAssignable<WevuConfigDefaults>({ component: { custom: { nested: /value/ } } })
expectNotAssignable<WevuConfigDefaults>({ component: { custom: Symbol('value') } })
expectNotAssignable<WevuConfigDefaults>({ component: { custom: 1n } })
expectNotAssignable<WevuConfigDefaults>({ app: { custom: { nested: () => {} } } })

declare const setData: WevuConfigSetDataOptions
expectType<'diff' | 'patch' | undefined>(setData.strategy)
expectType<undefined>(setData.debug)
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void wx
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void my
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void tt
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void document
// @ts-expect-error 纯类型入口不得合入小程序模板的 DOM 标签接口。
export type NoDomTagMap = HTMLElementTagNameMap
