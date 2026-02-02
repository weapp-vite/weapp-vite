import {
  callHookList,
  callHookReturn,
  defineComponent,
  getCurrentInstance,
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
  ref,
  useBindModel,
  useTemplateRef,
} from 'wevu'
import { defaultsSnapshot } from '../../shared/defaults'
import { buildResult, stringifyResult } from '../../shared/e2e'

const TEMPLATE_REFS = [
  {
    selector: '#runtime-ref',
    inFor: false,
    name: 'runtimeRef',
    kind: 'element',
  },
]

export default defineComponent({
  __wevuTemplateRefs: TEMPLATE_REFS,
  data: () => ({
    form: {
      title: 'hello',
    },
    childCount: 1,
    childTitle: 'child',
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
    const addHook = (name: string) => {
      hookLogs.value.push(name)
    }

    const instance = getCurrentInstance()
    const setupCtx = getCurrentSetupContext()

    provide('runtime:local', 'local-value')
    provideGlobal('runtime:global', 'global-value')

    const localInjected = inject('runtime:local')
    const globalInjected = inject('runtime:global')
    const explicitGlobal = injectGlobal('runtime:global')

    const templateRef = useTemplateRef('runtimeRef')

    const bindModel = useBindModel({ event: 'input', valueProp: 'value' })
    const titleModel = bindModel.model<string>('form.title')
    const titleOnInput = bindModel.on('form.title')
    const ctxBindModel = ctx.bindModel('form.title')
    const ctxModelPayload = ctxBindModel.model({ event: 'input' })

    const classText = normalizeClass(['a', { b: true, c: false }, ['d']])
    const styleText = normalizeStyle([
      { fontSize: '16px', lineHeight: 1.2 },
      'color:red',
    ])

    const mergedArray = mergeModels([1, 2], [2, 3])
    const mergedObject = mergeModels({ a: 1 }, { b: 2 })

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
    onShareAppMessage(() => {
      addHook('onShareAppMessage')
      return { title: 'share' }
    })
    onShareTimeline(() => {
      addHook('onShareTimeline')
      return { title: 'timeline' }
    })
    onAddToFavorites(() => {
      addHook('onAddToFavorites')
      return { title: 'favorites' }
    })
    onSaveExitState(() => {
      addHook('onSaveExitState')
      return { data: { key: 'value' } }
    })
    onUnhandledRejection(() => addHook('onUnhandledRejection'))

    onMounted(() => addHook('onMounted'))
    onBeforeMount(() => addHook('onBeforeMount'))
    onBeforeUnmount(() => addHook('onBeforeUnmount'))
    onUnmounted(() => addHook('onUnmounted'))
    onBeforeUpdate(() => addHook('onBeforeUpdate'))
    onUpdated(() => addHook('onUpdated'))
    onActivated(() => addHook('onActivated'))
    onDeactivated(() => addHook('onDeactivated'))
    onErrorCaptured(() => addHook('onErrorCaptured'))

    const runE2E = async () => {
      const target = ctx.instance as any
      const child = target?.selectComponent?.('#child') as any
      const model = target?.selectComponent?.('#model') as any
      const compat = target?.selectComponent?.('#compat') as any
      const scoped = target?.selectComponent?.('#scoped') as any

      const beforeHooks = hookLogs.value.slice()
      callHookList(target as any, 'onPageScroll', [{ scrollTop: 10 }])
      callHookList(target as any, 'onReachBottom', [])
      callHookList(target as any, 'onPullDownRefresh', [])
      callHookList(target as any, 'onTabItemTap', [{ index: 0, pagePath: 'pages/runtime/index' }])
      callHookList(target as any, 'onRouteDone', [{}])
      callHookList(target as any, 'onResize', [{ size: { windowWidth: 375, windowHeight: 667 } }])
      callHookList(target as any, 'onMoved', [])
      callHookList(target as any, 'onError', [new Error('runtime-error')])
      callHookList(target as any, 'onUnhandledRejection', [{ reason: 'rejected' }])

      const shareResult = callHookReturn(target as any, 'onShareAppMessage', [{}])
      const timelineResult = callHookReturn(target as any, 'onShareTimeline', [{}])
      const favoritesResult = callHookReturn(target as any, 'onAddToFavorites', [{}])
      const exitStateResult = callHookReturn(target as any, 'onSaveExitState', [{}])

      ctxModelPayload.onInput({ detail: { value: 'from-ctx' } })
      titleModel.onInput({ detail: { value: 'changed' } })
      await nextTick()

      const childEmit = typeof child?.fire === 'function' ? child.fire() : null
      const childAttrs = child?.data?.attrsSummary ?? ''
      const childSlots = child?.data?.slotsSummary ?? ''
      const compatBump = typeof compat?.bump === 'function' ? compat.bump() : null

      const modelBefore = typeof model?.read === 'function' ? model.read() : null
      if (typeof model?.triggerModel === 'function') {
        model.triggerModel('model-next')
      }
      await nextTick()
      const modelAfter = typeof model?.read === 'function' ? model.read() : null

      const afterHooks = hookLogs.value.slice()
      const extraHooks = afterHooks.slice(beforeHooks.length)

      const checks = {
        inSetupInstance: Boolean(instance),
        inSetupContext: Boolean(setupCtx),
        outsideSetupInstance: getCurrentInstance() == null,
        bindModelUpdated: target?.data?.form?.title === 'changed',
        bindModelHelpers: Boolean(titleOnInput) && bindModel.value('form.title') === 'changed',
        ctxBindModel: typeof ctxModelPayload.onInput === 'function',
        templateRefReady: Boolean(templateRef.value?.selector === '#runtime-ref'),
        hooksCollected: extraHooks.length >= 8,
        shareResult: shareResult?.title === 'share',
        timelineResult: timelineResult?.title === 'timeline',
        favoritesResult: favoritesResult?.title === 'favorites',
        exitStateResult: Boolean(exitStateResult?.data?.key),
        normalizeClass: classText === 'a b d',
        normalizeStyle: styleText.includes('font-size:16px') && styleText.includes('color:red'),
        mergeArray: Array.isArray(mergedArray) && mergedArray.length === 3,
        mergeObject: mergedObject?.b === 2,
        childEmit: childEmit === 1,
        childAttrs: childAttrs === '[]',
        childSlots: childSlots === '[]',
        compatComponent: compatBump === 1,
        scopedComponent: Boolean(scoped),
        modelEmitLogged: Array.isArray(modelAfter?.logs) && modelAfter?.logs.length > 0,
        localInjected: localInjected === 'local-value',
        globalInjected: globalInjected === 'global-value',
        explicitGlobal: explicitGlobal === 'global-value',
        defaultsApplied: defaultsSnapshot.multipleSlots === false && defaultsSnapshot.maxPatchKeys === 1,
      }

      const result = buildResult('runtime', checks, {
        beforeHooks,
        afterHooks,
        extraHooks,
        shareResult,
        timelineResult,
        favoritesResult,
        exitStateResult,
        modelBefore,
        modelAfter,
      })

      target?.setData?.({
        __e2e: result,
        __e2eText: stringifyResult(result),
      })

      return result
    }

    return {
      hookLogs,
      instance,
      setupCtx,
      localInjected,
      globalInjected,
      explicitGlobal,
      templateRef,
      titleModel,
      titleOnInput,
      classText,
      styleText,
      mergedArray,
      mergedObject,
      runE2E,
    }
  },
})
