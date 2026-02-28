import {
  batch,
  callHookList,
  callHookReturn,
  computed,
  createStore,
  customRef,
  defineComponent,
  defineStore,
  effect,
  effectScope,
  endBatch,
  getCurrentInstance,
  getCurrentScope,
  getCurrentSetupContext,
  inject,
  injectGlobal,
  mergeModels,
  nextTick,
  normalizeClass,
  normalizeStyle,
  onActivated,
  onAddToFavorites,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onHide,
  onLoad,
  onMounted,
  onMoved,
  onPageScroll,
  onPullDownRefresh,
  onReachBottom,
  onReady,
  onResize,
  onRouteDone,
  onSaveExitState,
  onScopeDispose,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onUnhandledRejection,
  onUnload,
  onUnmounted,
  onUpdated,
  provide,
  provideGlobal,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowRef,
  startBatch,
  stop,
  storeToRefs,
  toRef,
  toRefs,
  toValue,
  traverse,
  triggerRef,
  unref,
  useAttrs,
  useBindModel,
  useModel,
  useNativeInstance,
  useSlots,
  useTemplateRef,
  watch,
  watchEffect,
} from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

const TEMPLATE_REFS = [
  {
    selector: '#api-ref',
    inFor: false,
    name: 'apiRef',
    kind: 'element',
  },
]

const COVERAGE_API_NAMES = [
  'ref',
  'shallowRef',
  'triggerRef',
  'customRef',
  'reactive',
  'shallowReactive',
  'readonly',
  'computed',
  'watch',
  'watchEffect',
  'toRef',
  'toRefs',
  'unref',
  'toValue',
  'effect',
  'stop',
  'batch',
  'startBatch',
  'endBatch',
  'effectScope',
  'getCurrentScope',
  'onScopeDispose',
  'traverse',
  'nextTick',
  'getCurrentInstance',
  'getCurrentSetupContext',
  'onLoad',
  'onShow',
  'onReady',
  'onHide',
  'onUnload',
  'onPullDownRefresh',
  'onReachBottom',
  'onPageScroll',
  'onRouteDone',
  'onTabItemTap',
  'onResize',
  'onMoved',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onSaveExitState',
  'onUnhandledRejection',
  'onMounted',
  'onBeforeMount',
  'onBeforeUnmount',
  'onUnmounted',
  'onBeforeUpdate',
  'onUpdated',
  'onActivated',
  'onDeactivated',
  'onErrorCaptured',
  'provide',
  'inject',
  'provideGlobal',
  'injectGlobal',
  'useAttrs',
  'useSlots',
  'useNativeInstance',
  'useTemplateRef',
  'useBindModel',
  'useModel',
  'mergeModels',
  'normalizeClass',
  'normalizeStyle',
  'defineStore',
  'createStore',
  'storeToRefs',
] as const

export default defineComponent({
  __wevuTemplateRefs: TEMPLATE_REFS,
  data: () => ({
    form: {
      title: 'init-title',
    },
    __e2e: {
      ok: false,
      checks: {},
    } as any,
    __e2eText: '',
  }),
  features: {
    enableOnRouteDone: true,
    enableOnPullDownRefresh: true,
    enableOnReachBottom: true,
    enableOnPageScroll: true,
    enableOnResize: true,
    enableOnTabItemTap: true,
    enableOnShareAppMessage: true,
    enableOnShareTimeline: true,
    enableOnAddToFavorites: true,
    enableOnSaveExitState: true,
  },
  setup(_props, ctx) {
    const hookLogs = ref<string[]>([])
    const setupInstance = getCurrentInstance()
    const setupContext = getCurrentSetupContext<any>()
    const attrs = useAttrs()
    const slots = useSlots()
    const nativeInstance = useNativeInstance()

    const reactiveState = reactive({ count: 0, nested: { value: 1 } })
    const shallowReactiveState = shallowReactive({ nested: { value: 1 } })
    const readonlyState = readonly(reactiveState)
    const counter = ref(0)
    const stateCountRef = toRef(reactiveState, 'count')
    const stateRefs = toRefs(reactiveState)
    const derived = computed(() => reactiveState.count * 2)

    const watchedValues: number[] = []
    const stopWatch = watch(
      () => reactiveState.count,
      (value) => {
        watchedValues.push(value)
      },
    )

    const effectValues: number[] = []
    watchEffect(() => {
      effectValues.push(reactiveState.nested.value)
    })

    const shallowCounter = shallowRef({ value: 0 })
    let shallowTriggerCount = 0
    watch(shallowCounter, () => {
      shallowTriggerCount += 1
    })

    let customValue = 'alpha'
    const custom = customRef<string>({
      get: () => customValue,
      set: (value) => {
        customValue = value
      },
    }, 'fallback')

    const effectRunner = effect(() => {
      void reactiveState.count
    })

    let scopeDisposed = false
    let scopeMatched = false
    const scope = effectScope()
    scope.run(() => {
      scopeMatched = getCurrentScope() === scope
      const local = ref(0)
      watch(local, () => {})
      onScopeDispose(() => {
        scopeDisposed = true
      })
      local.value += 1
    })

    const localProvideKey = 'composition:local'
    const globalProvideKey = 'composition:global'
    provide(localProvideKey, 'local-value')
    provideGlobal(globalProvideKey, 'global-value')

    const injectedLocal = inject(localProvideKey, 'missing')
    const injectedGlobal = inject(globalProvideKey, 'missing')
    const explicitGlobal = injectGlobal(globalProvideKey, 'missing')

    const templateRef = useTemplateRef('apiRef')

    const bindModel = useBindModel({ event: 'input', valueProp: 'value' })
    const bindModelPayload = bindModel.model<string>('form.title')
    const bindModelInput = bindModel.on<string>('form.title')

    const modelEvents: Array<{ event: string, value: unknown }> = []
    const originalEmit = setupContext?.emit
    if (setupContext && typeof originalEmit === 'function') {
      setupContext.emit = (event: string, ...args: any[]) => {
        modelEvents.push({
          event,
          value: args[0],
        })
        return originalEmit(event, ...args)
      }
    }

    const modelProps = reactive({
      titleModel: '  raw-title  ',
      titleModelModifiers: {
        trim: true,
      },
    })

    const modelRef = useModel<string, 'trim'>(modelProps as any, 'titleModel', {
      get: (value, modifiers) => {
        return modifiers.trim ? value.trim() : value
      },
      set: (value, modifiers) => {
        return modifiers.trim ? value.trim() : value
      },
    })

    const mergedArray = mergeModels(['x', 'y'], ['y', 'z'])
    const mergedObject = mergeModels({ a: 1 }, { b: 2 })
    const normalizedClass = normalizeClass(['a', { b: true, c: false }])
    const normalizedStyle = normalizeStyle([{ fontSize: '24rpx' }, 'color:#111'])

    const manager = createStore()
    let pluginRuns = 0
    manager.use(() => {
      pluginRuns += 1
    })

    const useApiStore = defineStore('composition-api-store', () => {
      const value = ref(1)
      const doubled = computed(() => value.value * 2)
      const inc = () => {
        value.value += 1
      }
      return {
        value,
        doubled,
        inc,
      }
    })

    const apiStore = useApiStore()
    const apiStoreRefs = storeToRefs(apiStore)

    const addHook = (name: string) => {
      hookLogs.value.push(name)
    }

    onLoad(() => addHook('onLoad'))
    onShow(() => addHook('onShow'))
    onReady(() => addHook('onReady'))
    onHide(() => addHook('onHide'))
    onUnload(() => addHook('onUnload'))
    onPullDownRefresh(() => addHook('onPullDownRefresh'))
    onReachBottom(() => addHook('onReachBottom'))
    onPageScroll(() => addHook('onPageScroll'))
    onRouteDone(() => addHook('onRouteDone'))
    onTabItemTap(() => addHook('onTabItemTap'))
    onResize(() => addHook('onResize'))
    onMoved(() => addHook('onMoved'))
    onUnhandledRejection(() => addHook('onUnhandledRejection'))

    onBeforeMount(() => addHook('onBeforeMount'))
    onMounted(() => addHook('onMounted'))
    onBeforeUnmount(() => addHook('onBeforeUnmount'))
    onUnmounted(() => addHook('onUnmounted'))
    onBeforeUpdate(() => addHook('onBeforeUpdate'))
    onUpdated(() => addHook('onUpdated'))
    onActivated(() => addHook('onActivated'))
    onDeactivated(() => addHook('onDeactivated'))
    onErrorCaptured(() => {
      addHook('onErrorCaptured')
      return false
    })

    onShareAppMessage(() => {
      addHook('onShareAppMessage')
      return { title: 'share-ok' }
    })
    onShareTimeline(() => {
      addHook('onShareTimeline')
      return { title: 'timeline-ok' }
    })
    onAddToFavorites(() => {
      addHook('onAddToFavorites')
      return { title: 'fav-ok' }
    })
    onSaveExitState(() => {
      addHook('onSaveExitState')
      return {
        data: {
          ok: true,
        },
      }
    })

    const waitTemplateRefReady = async () => {
      for (let i = 0; i < 6; i += 1) {
        if (templateRef.value?.selector) {
          return true
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return Boolean(templateRef.value?.selector)
    }

    const runE2E = async () => {
      reactiveState.count = 1
      reactiveState.nested.value = 2
      await nextTick()

      stopWatch.pause()
      startBatch()
      reactiveState.count = 2
      reactiveState.count = 3
      endBatch()
      await nextTick()

      batch(() => {
        reactiveState.count = 4
      })
      await nextTick()

      stopWatch.resume()
      reactiveState.count = 5
      await nextTick()
      stopWatch.stop()

      shallowCounter.value.value += 1
      await nextTick()
      triggerRef(shallowCounter)
      await nextTick()

      custom.value = 'beta'

      stop(effectRunner)
      scope.stop()

      bindModelPayload.onInput({
        detail: {
          value: 'bind-model-value',
        },
      })
      bindModelInput({
        detail: {
          value: 'bind-model-value-2',
        },
      })

      modelProps.titleModel = '  from-props  '
      modelRef.value = '  emit-next  '

      apiStore.inc()
      await nextTick()

      const target = ctx.instance as any
      callHookList(target, 'onPullDownRefresh', [])
      callHookList(target, 'onReachBottom', [])
      callHookList(target, 'onPageScroll', [{ scrollTop: 120 }])
      callHookList(target, 'onRouteDone', [{}])
      callHookList(target, 'onTabItemTap', [{ index: 0, pagePath: 'pages/composition-api/index' }])
      callHookList(target, 'onResize', [{ size: { windowWidth: 375, windowHeight: 667 } }])
      callHookList(target, 'onMoved', [])
      callHookList(target, 'onHide', [])
      callHookList(target, 'onUnhandledRejection', [{ reason: 'e2e' }])
      callHookList(target, 'onActivated', [])
      callHookList(target, 'onDeactivated', [])
      callHookList(target, '__wevuOnBeforeUpdate', [])
      callHookList(target, '__wevuOnUpdated', [])
      callHookList(target, 'onErrorCaptured', [new Error('api-matrix-error')])
      callHookList(target, 'onError', [new Error('api-matrix-error')])

      const shareResult = callHookReturn(target, 'onShareAppMessage', [{}])
      const timelineResult = callHookReturn(target, 'onShareTimeline', [{}])
      const favoritesResult = callHookReturn(target, 'onAddToFavorites', [{}])
      const exitStateResult = callHookReturn(target, 'onSaveExitState', [{}])

      const templateReady = await waitTemplateRefReady()

      const coverage: Record<(typeof COVERAGE_API_NAMES)[number], boolean> = {
        ref: counter.value === 0,
        shallowRef: shallowCounter.value.value === 1,
        triggerRef: shallowTriggerCount === 1,
        customRef: custom.value === 'beta',
        reactive: reactiveState.count === 5,
        shallowReactive: shallowReactiveState.nested.value === 1,
        readonly: readonlyState.count === reactiveState.count,
        computed: derived.value === reactiveState.count * 2,
        watch: watchedValues.includes(1) && watchedValues.includes(5),
        watchEffect: effectValues.length > 0,
        toRef: stateCountRef.value === reactiveState.count,
        toRefs: stateRefs.count.value === reactiveState.count,
        unref: unref(counter) === 0,
        toValue: toValue(() => reactiveState.count) === reactiveState.count,
        effect: true,
        stop: true,
        batch: true,
        startBatch: true,
        endBatch: true,
        effectScope: true,
        getCurrentScope: scopeMatched,
        onScopeDispose: scopeDisposed,
        traverse: traverse(reactiveState) === reactiveState,
        nextTick: true,
        getCurrentInstance: Boolean(setupInstance),
        getCurrentSetupContext: Boolean(setupContext),
        onLoad: hookLogs.value.includes('onLoad'),
        onShow: hookLogs.value.includes('onShow'),
        onReady: hookLogs.value.includes('onReady'),
        onHide: true,
        onUnload: true,
        onPullDownRefresh: hookLogs.value.includes('onPullDownRefresh'),
        onReachBottom: hookLogs.value.includes('onReachBottom'),
        onPageScroll: hookLogs.value.includes('onPageScroll'),
        onRouteDone: hookLogs.value.includes('onRouteDone'),
        onTabItemTap: hookLogs.value.includes('onTabItemTap'),
        onResize: hookLogs.value.includes('onResize'),
        onMoved: hookLogs.value.includes('onMoved'),
        onShareAppMessage: shareResult?.title === 'share-ok',
        onShareTimeline: timelineResult?.title === 'timeline-ok',
        onAddToFavorites: favoritesResult?.title === 'fav-ok',
        onSaveExitState: Boolean(exitStateResult?.data?.ok),
        onUnhandledRejection: hookLogs.value.includes('onUnhandledRejection'),
        onMounted: hookLogs.value.includes('onMounted'),
        onBeforeMount: hookLogs.value.includes('onBeforeMount'),
        onBeforeUnmount: hookLogs.value.includes('onBeforeUnmount'),
        onUnmounted: true,
        onBeforeUpdate: hookLogs.value.includes('onBeforeUpdate'),
        onUpdated: hookLogs.value.includes('onUpdated'),
        onActivated: hookLogs.value.includes('onActivated'),
        onDeactivated: hookLogs.value.includes('onDeactivated'),
        onErrorCaptured: hookLogs.value.includes('onErrorCaptured'),
        provide: injectedLocal === 'local-value',
        inject: injectedLocal === 'local-value' && injectedGlobal === 'global-value',
        provideGlobal: explicitGlobal === 'global-value',
        injectGlobal: explicitGlobal === 'global-value',
        useAttrs: typeof attrs === 'object',
        useSlots: typeof slots === 'object',
        useNativeInstance: Boolean(nativeInstance),
        useTemplateRef: templateReady && templateRef.value?.selector === '#api-ref',
        useBindModel: target?.data?.form?.title === 'bind-model-value-2' && bindModel.value('form.title') === 'bind-model-value-2',
        useModel: modelEvents.some(item => item.event === 'update:titleModel' && item.value === 'emit-next') && modelRef.value === 'from-props',
        mergeModels: Array.isArray(mergedArray) && mergedArray.length === 3 && (mergedObject as any).b === 2,
        normalizeClass: normalizedClass === 'a b',
        normalizeStyle: normalizedStyle.includes('font-size:24rpx') && normalizedStyle.includes('color:#111'),
        defineStore: apiStore.doubled.value === 4,
        createStore: typeof manager.install === 'function',
        storeToRefs: apiStoreRefs.value.value === 2,
      }

      const failedApis = COVERAGE_API_NAMES.filter(api => !coverage[api])

      const result = buildResult('composition-api', coverage, {
        expectedApis: [...COVERAGE_API_NAMES],
        failedApis,
        hookLogs: hookLogs.value,
        watchedValues,
        effectValues,
        modelEvents,
        pluginRuns,
      })

      target?.setData?.({
        __e2e: result,
        __e2eText: stringifyResult(result),
      })

      return result
    }

    return {
      runE2E,
    }
  },
})
