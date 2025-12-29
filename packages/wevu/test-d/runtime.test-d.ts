import type { RuntimeApp } from '@/index'
import { expectError, expectType } from 'tsd'
import {
  createWevuComponent,
  defineComponent,
  inject,
  injectGlobal,
  nextTick,
  onActivated,
  onAddToFavorites,
  onAppError,
  onAppHide,
  onAppShow,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onHide,
  onMounted,
  onPageScroll,
  onReady,
  onRouteDone,
  onSaveExitState,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onUnmounted,
  onUpdated,
  provide,
  provideGlobal,
  registerApp,
  registerComponent,

} from '@/index'

const TOKEN = Symbol('token')
type RT = RuntimeApp<Record<string, any>, Record<string, any>, Record<string, (...args: any[]) => any>>
const runtimeApp = {} as RT

defineComponent({
  props: {
    title: String,
    count: { type: Number, default: 1 },
  },
  setup(props, ctx) {
    expectType<string | undefined>(props.title)
    expectType<number>(props.count)
    expectType<void>(ctx.emit('update', props.count))
    ctx.expose?.({ a: 1 })
    const model = ctx.bindModel<number>('path')
    expectType<number>(model.value)
    expectType<void>(model.update(2))
    expectType<Record<string, any>>(model.model())
    const injected = inject<number>(TOKEN, 0)
    expectType<number>(injected)
    provide(TOKEN, props.count)
    expectType<number>(inject<number>(TOKEN))
    onMounted(() => {})
    onShow(() => {})
    onHide(() => {})
    onReady(() => {})
    onPageScroll(() => {})
    onRouteDone(() => {})
    onTabItemTap(() => {})
    onSaveExitState(() => ({}))
    onShareAppMessage(() => ({}))
    onShareTimeline(() => ({}))
    onAddToFavorites(() => ({}))
    onUpdated(() => {})
    onBeforeUpdate(() => {})
    onBeforeUnmount(() => {})
    onUnmounted(() => {})
    onBeforeMount(() => {})
    onErrorCaptured(() => {})
    onActivated(() => {})
    onDeactivated(() => {})
    onAppShow(() => {})
    onAppHide(() => {})
    onAppError(() => {})
    return {}
  },
})

defineComponent({
  props: {
    id: String,
  },
  setup(props) {
    expectType<string | undefined>(props.id)
    return {}
  },
})

createWevuComponent({
  props: {
    foo: String,
  },
  setup(props) {
    expectType<string | undefined>(props.foo)
    return {}
  },
})

registerApp(runtimeApp, {}, undefined as any, undefined, {})
registerComponent(runtimeApp, {}, undefined as any, undefined, {})

provideGlobal(TOKEN, 1)
const globalVal = injectGlobal<number>(TOKEN, 2)
expectType<number>(globalVal)
expectError(injectGlobal<string>(TOKEN))

nextTick().then(() => {})
