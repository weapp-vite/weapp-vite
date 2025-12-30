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
  behaviors: [],
  externalClasses: ['custom-class'],
  options: {
    multipleSlots: true,
    styleIsolation: 'isolated',
  },
  observers: {
    count() {},
  },
  relations: {
    './child': {
      type: 'child',
    },
  },
  lifetimes: {
    created() {},
    attached() {},
    ready() {},
    moved() {},
    detached() {},
    error(err) {
      expectType<Error>(err)
    },
  },
  pageLifetimes: {
    show() {},
    hide() {},
    resize(size) {
      expectType<WechatMiniprogram.Page.IResizeOption>(size)
    },
    routeDone() {},
  },
  definitionFilter() {},
  export: () => ({}),
  props: {
    title: String,
    count: { type: Number, default: 1 },
  },
  setup(props, ctx) {
    expectType<string | undefined>(props.title)
    expectType<number>(props.count)
    expectType<void>(ctx.emit('update', props.count))
    expectType<void>(ctx.emit('customevent', {}, { bubbles: true, composed: true, capturePhase: true }))
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
    onPageScroll((opt) => {
      expectType<WechatMiniprogram.Page.IPageScrollOption>(opt)
    })
    onRouteDone(() => {})
    onTabItemTap((opt) => {
      expectType<WechatMiniprogram.Page.ITabItemTapOption>(opt)
    })
    onSaveExitState(() => ({ data: {} }))
    onShareAppMessage((opt) => {
      expectType<WechatMiniprogram.Page.IShareAppMessageOption>(opt)
      return {}
    })
    onShareTimeline(() => ({}))
    onAddToFavorites((opt) => {
      expectType<WechatMiniprogram.Page.IAddToFavoritesOption>(opt)
      return {}
    })
    onUpdated(() => {})
    onBeforeUpdate(() => {})
    onBeforeUnmount(() => {})
    onUnmounted(() => {})
    onBeforeMount(() => {})
    onErrorCaptured(() => {})
    onActivated(() => {})
    onDeactivated(() => {})
    onAppShow((opt) => {
      expectType<WechatMiniprogram.App.LaunchShowOption>(opt)
    })
    onAppHide(() => {})
    onAppError((err) => {
      expectType<string>(err)
    })
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
