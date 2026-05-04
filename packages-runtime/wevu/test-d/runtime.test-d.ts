import type {
  ComponentOptionsMixin,
  DefineComponent,
  MiniProgramAddToFavoritesOption,
  MiniProgramBoundingClientRectResult,
  MiniProgramIntersectionObserver,
  MiniProgramLaunchOptions,
  MiniProgramMemoryWarningResult,
  MiniProgramPageNotFoundOptions,
  MiniProgramPageResizeOption,
  MiniProgramPageScrollOption,
  MiniProgramScrollOffsetResult,
  MiniProgramShareAppMessageOption,
  MiniProgramTabItemTapOption,
  MiniProgramThemeChangeResult,
  MiniProgramUnhandledRejectionResult,
  ModelBindingPayload,
  PublicProps,
  RuntimeApp,
  SetupContextIntersectionObserver,
  SetupContextRouter,
  SetupContextSelectorQuery,
} from '@/index'
import { expectAssignable, expectType } from 'tsd'
import {
  createApp,
  createWevuComponent,
  defineAppSetup,
  defineComponent,
  hasInjectionContext,
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
  onMemoryWarning,
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
  shallowReadonly,
  useBoundingClientRect,
  useDisposables,
  useElementIntersectionObserver,
  useIntersectionObserver,
  useNativeInstance,
  useNativePageRouter,
  useNativeRouter,
  useNavigationBarMetrics,
  usePageScrollThrottle,
  usePageStack,
  useScrollOffset,
  useSelectorFields,
  useSelectorQuery,
  useUpdatePerformanceListener,
  version,
} from '@/index'

const TOKEN = Symbol('token')
type RT = RuntimeApp<Record<string, any>, Record<string, any>, Record<string, (...args: any[]) => any>>
const runtimeApp = {} as RT
expectType<string>(version)
expectType<RuntimeApp<any, any, any>>(defineAppSetup(app => app))
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
  data: {
    scriptMarker: 'DEFAULT-LAYOUT-SCRIPT-BASE',
  },
})

defineComponent({
  allowNullPropInput: true,
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
      expectType<MiniProgramPageResizeOption>(size)
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
    expectType<boolean>(hasInjectionContext())
    expectType<string | undefined>(props.title)
    expectType<number>(props.count)
    expectType<void>(ctx.emit('update', props.count))
    expectType<void>(ctx.emit('customevent', {}, { bubbles: true, composed: true, capturePhase: true }))
    expectType<void>(ctx.emit('multi-args', 1, 2, 3))
    expectType<void>(ctx.instance.triggerEvent('update', props.count))
    expectType<SetupContextSelectorQuery | undefined>(ctx.instance.createSelectorQuery())
    expectType<SetupContextIntersectionObserver | undefined>(ctx.instance.createIntersectionObserver())
    expectType<void | Promise<void> | undefined>(ctx.instance.setData({ count: props.count }))
    expectType<void | undefined>(ctx.instance.setUpdatePerformanceListener(() => {}))
    expectAssignable<SetupContextRouter | undefined>(ctx.instance.router)
    expectAssignable<SetupContextRouter | undefined>(ctx.instance.pageRouter)
    ctx.expose({ a: 1 })
    const model = ctx.bindModel<number>('path')
    expectType<number>(model.value)
    expectType<void>(model.update(2))
    expectType<ModelBindingPayload<number>>(model.model())
    const injected = inject<number>(TOKEN, 0)
    expectType<number>(injected)
    provide(TOKEN, props.count)
    expectType<number | undefined>(inject<number>(TOKEN))
    const readonlyProps = shallowReadonly(props)
    expectType<string | undefined>(readonlyProps.title)
    onMounted(() => {})
    onShow(() => {})
    onHide(() => {})
    onReady(() => {})
    onPageScroll((opt) => {
      expectType<MiniProgramPageScrollOption>(opt)
    })
    onRouteDone(() => {})
    onTabItemTap((opt) => {
      expectType<MiniProgramTabItemTapOption>(opt)
    })
    onSaveExitState(() => ({ data: {} }))
    onShareAppMessage((opt) => {
      expectType<MiniProgramShareAppMessageOption>(opt)
      return {}
    })
    onShareTimeline(() => ({}))
    onAddToFavorites((opt) => {
      expectType<MiniProgramAddToFavoritesOption>(opt)
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
    const router = useNativeRouter()
    const pageRouter = useNativePageRouter()
    const stopPageScroll = usePageScrollThrottle((_opt) => {}, {
      interval: 120,
      leading: true,
      trailing: true,
      maxWait: 240,
    })
    expectType<() => void>(stopPageScroll)
    expectType<SetupContextRouter>(router)
    expectType<SetupContextRouter>(pageRouter)
    router.navigateTo({ url: '/pages/demo/index' })
    pageRouter.navigateBack({ delta: 1 })
    const io = useIntersectionObserver()
    expectType<MiniProgramIntersectionObserver>(io)
    const createQuery = useSelectorQuery()
    expectType<SetupContextSelectorQuery | null>(createQuery())
    const getRect = useBoundingClientRect()
    expectType<Promise<MiniProgramBoundingClientRectResult | null>>(getRect('.card'))
    const getRects = useBoundingClientRect({ all: true })
    expectType<Promise<MiniProgramBoundingClientRectResult[] | null>>(getRects('.card'))
    const getFields = useSelectorFields({ fields: { size: true } })
    expectType<Promise<Record<string, any> | null>>(getFields('.card'))
    const getScrollOffset = useScrollOffset()
    expectType<Promise<MiniProgramScrollOffsetResult | null>>(getScrollOffset('.scroll'))
    const elementObserver = useElementIntersectionObserver({
      selector: '.card',
      onObserve(result) {
        expectType<unknown>(result)
      },
    })
    expectType<MiniProgramIntersectionObserver | null>(elementObserver.observer)
    expectType<MiniProgramIntersectionObserver | null>(elementObserver.observe())
    expectType<void>(elementObserver.disconnect())
    const pageStack = usePageStack()
    expectType<string>(pageStack.currentRoute.value)
    expectType<number>(pageStack.stackLength.value)
    expectType<boolean>(pageStack.canGoBack.value)
    const navigationMetrics = useNavigationBarMetrics()
    expectType<number>(navigationMetrics.statusBarHeight.value)
    expectType<number>(navigationMetrics.navigationBarHeight.value)
    expectType<number>(navigationMetrics.navigationHeight.value)
    const stopPerfListen = useUpdatePerformanceListener((_result) => {})
    expectType<() => void>(stopPerfListen)
    const bag = useDisposables()
    const removeCleanup = bag.add(() => {})
    expectType<() => void>(removeCleanup)
    expectType<void>(bag.dispose())
    expectAssignable<ReturnType<typeof setTimeout>>(bag.setTimeout(() => {}, 16))
    expectAssignable<ReturnType<typeof setInterval>>(bag.setInterval(() => {}, 16))
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
expectType<string>(injectGlobal<string>(TOKEN, 'fallback'))

nextTick().then(() => {})

createApp({
  data: {
    count: 0,
  },
})

createApp({
  setup() {
    onLaunch((opt) => {
      expectType<MiniProgramLaunchOptions>(opt)
    })
    onPageNotFound((opt) => {
      expectType<MiniProgramPageNotFoundOptions>(opt)
    })
    onUnhandledRejection((opt) => {
      expectType<MiniProgramUnhandledRejectionResult>(opt)
    })
    onThemeChange((opt) => {
      expectType<MiniProgramThemeChangeResult>(opt)
    })
    onMemoryWarning((opt) => {
      expectType<MiniProgramMemoryWarningResult>(opt)
    })
  },
})
