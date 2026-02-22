import type { ComponentOptionsMixin, DefineComponent, ModelBindingPayload, PublicProps, RuntimeApp } from '@/index'
import { expectError, expectType } from 'tsd'
import {
  createApp,
  createWevuComponent,
  defineComponent,
  inject,
  injectGlobal,
  nextTick,
  onActivated,
  onAddToFavorites,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onHide,
  onLaunch,
  onMounted,
  onPageNotFound,
  onPageScroll,
  onReady,
  onRouteDone,
  onSaveExitState,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onThemeChange,
  onUnhandledRejection,
  onUnmounted,
  onUpdated,
  provide,
  provideGlobal,
  registerApp,
  registerComponent,
  resetWevuDefaults,
  setWevuDefaults,
  useNativeInstance,

} from '@/index'

const TOKEN = Symbol('token')
type RT = RuntimeApp<Record<string, any>, Record<string, any>, Record<string, (...args: any[]) => any>>
const runtimeApp = {} as RT
type _WevuDefineComponent = DefineComponent
type _WevuComponentOptionsMixin = ComponentOptionsMixin
type _WevuPublicProps = PublicProps

setWevuDefaults({
  component: {
    options: {
      styleIsolation: 'apply-shared',
    },
  },
  app: {
    setData: {
      includeComputed: false,
    },
  },
})
resetWevuDefaults()

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
    expectType<void>(ctx.emit('multi-args', 1, 2, 3))
    expectType<void>(ctx.instance.triggerEvent('update', props.count))
    expectType<WechatMiniprogram.SelectorQuery | undefined>(ctx.instance.createSelectorQuery())
    expectType<void | Promise<void> | undefined>(ctx.instance.setData({ count: props.count }))
    ctx.expose({ a: 1 })
    const model = ctx.bindModel<number>('path')
    expectType<number>(model.value)
    expectType<void>(model.update(2))
    expectType<ModelBindingPayload<number>>(model.model())
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
    const nativeInstance = useNativeInstance()
    expectType<void>(nativeInstance.triggerEvent('from-helper', { ok: true }))
    return {}
  },
})

defineComponent({
  behaviors: ['wx://component-export'],
  setup(_props, ctx) {
    ctx.expose({ ok: true })
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

createApp({
  setup() {
    onLaunch((opt) => {
      expectType<WechatMiniprogram.App.LaunchShowOption>(opt)
    })
    onPageNotFound((opt) => {
      expectType<WechatMiniprogram.App.PageNotFoundOption>(opt)
    })
    onUnhandledRejection((opt) => {
      expectType<WechatMiniprogram.OnUnhandledRejectionListenerResult>(opt)
    })
    onThemeChange((opt) => {
      expectType<WechatMiniprogram.OnThemeChangeListenerResult>(opt)
    })
  },
})
