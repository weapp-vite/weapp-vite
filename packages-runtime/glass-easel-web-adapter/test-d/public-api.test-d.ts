import type { GlassEaselComponentDefinition, GlassEaselWebAdapter, GlassEaselWebInstance, GlassEaselWebSnapshot } from '@weapp-vite/glass-easel-web-adapter'
import type { GeneralComponent } from 'glass-easel'
import {
  createGlassEaselWebAdapter,
  getGlassEaselRuntimeInfo,
} from '@weapp-vite/glass-easel-web-adapter'
import { expectAssignable, expectError, expectType } from 'tsd'

const adapter = createGlassEaselWebAdapter()
expectAssignable<GlassEaselWebAdapter>(adapter)
expectType<boolean>(getGlassEaselRuntimeInfo().hasTemplateCompiler)

adapter.registerComponent({
  name: 'parent',
  template: '<child>{{count}}</child>',
  data: () => ({ count: 0 }),
  usingComponents: { child: '/child' },
  options: { multipleSlots: true },
  observers: { count(_value: unknown) {} },
  methods: {
    increment() {
      expectType<GeneralComponent>(this)
      this.setData({ count: 1 })
    },
  },
  lifetimes: {
    created() {
      expectType<GeneralComponent>(this)
    },
    detached() {
      expectType<GeneralComponent>(this)
    },
  },
})
expectAssignable<GlassEaselComponentDefinition>({ name: 'child', template: '<slot />', data: { count: 0 } })

const instance = adapter.mountComponent('parent', document.createElement('div'))
expectType<GlassEaselWebInstance>(instance)
expectType<HTMLElement>(instance.root)
expectType<GeneralComponent>(instance.native)
expectType<boolean>(instance.disposed)
expectAssignable<Readonly<Record<string, unknown>>>(instance.props)
expectType<GlassEaselWebSnapshot>(adapter.getSnapshot(instance))
expectType<void>(adapter.updateComponent(instance, { count: 2 }))
expectType<void>(adapter.triggerEvent(instance, 'change', { count: 2 }))
expectType<void>(adapter.unmountComponent(instance))

expectError(adapter.getSnapshot({}))
expectError(adapter.updateComponent({}, {}))
expectError(adapter.triggerEvent({}, 'change'))
expectError(adapter.unmountComponent({}))
expectError(instance.disposed = true)
expectError(instance.root = document.createElement('div'))
expectError(instance.props.count = 3)
