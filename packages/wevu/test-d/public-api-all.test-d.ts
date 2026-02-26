import type {
  AllowedComponentProps,
  AppConfig,
  ComponentCustomProps,
  ComponentPropsOptions,
  ComputedDefinitions,
  CreateAppOptions,
  DefineAppOptions,
  DefineComponent,
  DefineComponentOptions,
  ExtractComputed,
  ExtractDefaultPropTypes,
  ExtractMethods,
  ExtractPropTypes,
  ExtractPublicPropTypes,
  InferNativeProps,
  InferNativePropType,
  InferProps,
  InferPropType,
  InternalRuntimeState,
  InternalRuntimeStateFields,
  MethodDefinitions,
  MiniProgramAdapter,
  MiniProgramAppOptions,
  MiniProgramBehaviorIdentifier,
  MiniProgramComponentBehaviorOptions,
  MiniProgramComponentOptions,
  MiniProgramComponentRawOptions,
  MiniProgramInstance,
  MiniProgramPageLifetimes,
  ModelBinding,
  ModelBindingOptions,
  MutationKind,
  MutationOp,
  MutationRecord,
  NativeComponent,
  NativePropsOptions,
  NativePropType,
  NativeTypedProperty,
  NativeTypeHint,
  ObjectDirective,
  PageFeatures,
  PrelinkReactiveTreeOptions,
  PropConstructor,
  PropOptions,
  PropType,
  SetDataDebugInfo,
  SetDataSnapshotOptions,
  SetupContext,
  SetupContextNativeInstance,
  SetupFunction,
  ShallowUnwrapRef,
  TriggerEventOptions,
  VNode,
  VNodeProps,
  WevuPlugin,
} from 'wevu'
import type * as wevu from 'wevu'
import { expectType } from 'tsd'

type CompilerEntry = typeof import('wevu/compiler')
type WevuJsxRuntime = typeof import('wevu/jsx-runtime')

type RuntimeApiName
  = | 'addMutationRecorder'
    | 'batch'
    | 'callHookList'
    | 'callHookReturn'
    | 'callUpdateHooks'
    | 'computed'
    | 'createApp'
    | 'createStore'
    | 'createWevuComponent'
    | 'createWevuScopedSlotComponent'
    | 'defineComponent'
    | 'defineStore'
    | 'effect'
    | 'effectScope'
    | 'endBatch'
    | 'getCurrentInstance'
    | 'getCurrentScope'
    | 'getCurrentSetupContext'
    | 'getDeepWatchStrategy'
    | 'getReactiveVersion'
    | 'inject'
    | 'injectGlobal'
    | 'isNoSetData'
    | 'isRaw'
    | 'isReactive'
    | 'isRef'
    | 'isShallowReactive'
    | 'isShallowRef'
    | 'markNoSetData'
    | 'markRaw'
    | 'mergeModels'
    | 'mountRuntimeInstance'
    | 'nextTick'
    | 'normalizeClass'
    | 'normalizeStyle'
    | 'onActivated'
    | 'onAddToFavorites'
    | 'onAttached'
    | 'onBeforeMount'
    | 'onBeforeUnmount'
    | 'onBeforeUpdate'
    | 'onDeactivated'
    | 'onDetached'
    | 'onError'
    | 'onErrorCaptured'
    | 'onHide'
    | 'onLaunch'
    | 'onLoad'
    | 'onMounted'
    | 'onMoved'
    | 'onPageNotFound'
    | 'onPageScroll'
    | 'onPullDownRefresh'
    | 'onReachBottom'
    | 'onReady'
    | 'onResize'
    | 'onRouteDone'
    | 'onSaveExitState'
    | 'onScopeDispose'
    | 'onServerPrefetch'
    | 'onShareAppMessage'
    | 'onShareTimeline'
    | 'onShow'
    | 'onTabItemTap'
    | 'onThemeChange'
    | 'onUnhandledRejection'
    | 'onUnload'
    | 'onUnmounted'
    | 'onUpdated'
    | 'prelinkReactiveTree'
    | 'provide'
    | 'provideGlobal'
    | 'reactive'
    | 'readonly'
    | 'ref'
    | 'registerApp'
    | 'registerComponent'
    | 'removeMutationRecorder'
    | 'resetWevuDefaults'
    | 'runSetupFunction'
    | 'setCurrentInstance'
    | 'setCurrentSetupContext'
    | 'setDeepWatchStrategy'
    | 'setWevuDefaults'
    | 'shallowReactive'
    | 'shallowRef'
    | 'startBatch'
    | 'stop'
    | 'storeToRefs'
    | 'teardownRuntimeInstance'
    | 'toRaw'
    | 'toRef'
    | 'toRefs'
    | 'toValue'
    | 'touchReactive'
    | 'traverse'
    | 'triggerRef'
    | 'unref'
    | 'useAttrs'
    | 'useBindModel'
    | 'useModel'
    | 'useNativeInstance'
    | 'useSlots'
    | 'useTemplateRef'
    | 'watch'
    | 'watchEffect'

type ScriptSetupMacroApiName
  = | 'defineEmits'
    | 'defineExpose'
    | 'defineModel'
    | 'defineOptions'
    | 'defineProps'
    | 'defineSlots'
    | 'withDefaults'

type MissingRuntimeApi = Exclude<RuntimeApiName, keyof typeof wevu>
type MissingMacroApi = Exclude<ScriptSetupMacroApiName, keyof typeof wevu>

expectType<never>({} as MissingRuntimeApi)
expectType<never>({} as MissingMacroApi)
declare const compilerEntry: CompilerEntry
expectType<CompilerEntry>(compilerEntry)

declare const jsxRuntimeEntry: WevuJsxRuntime
expectType<WevuJsxRuntime>(jsxRuntimeEntry)

interface PublicApiPropsOptions extends ComponentPropsOptions {
  label: StringConstructor
  count: { type: NumberConstructor, value: 0 }
}

interface PublicApiNativePropsOptions extends NativePropsOptions {
  tone: { type: NativePropType<'neutral' | 'success'>, value: 'neutral' }
}

type _TypeCoverage = [
  AllowedComponentProps,
  AppConfig,
  ComponentCustomProps,
  ComponentPropsOptions,
  ComputedDefinitions,
  CreateAppOptions<any, any, any>,
  DefineAppOptions<any, any, any>,
  DefineComponent<PublicApiPropsOptions>,
  DefineComponentOptions<PublicApiPropsOptions, any, any, any>,
  ExtractComputed<any>,
  ExtractDefaultPropTypes<PublicApiPropsOptions>,
  ExtractMethods<any>,
  ExtractPropTypes<PublicApiPropsOptions>,
  ExtractPublicPropTypes<PublicApiPropsOptions>,
  InferPropType<StringConstructor>,
  InferNativePropType<PublicApiNativePropsOptions['tone']>,
  InferNativeProps<PublicApiNativePropsOptions>,
  InferProps<PublicApiPropsOptions>,
  InternalRuntimeState,
  InternalRuntimeStateFields,
  MethodDefinitions,
  MiniProgramAdapter,
  MiniProgramAppOptions,
  MiniProgramBehaviorIdentifier,
  MiniProgramComponentBehaviorOptions,
  MiniProgramComponentOptions,
  MiniProgramComponentRawOptions,
  MiniProgramInstance,
  MiniProgramPageLifetimes,
  ModelBinding<any>,
  ModelBindingOptions<any>,
  MutationKind,
  MutationOp,
  MutationRecord,
  NativePropType<any>,
  NativePropsOptions,
  NativeTypeHint<any>,
  NativeTypedProperty<any>,
  NativeComponent<any>,
  ObjectDirective<any, any>,
  PageFeatures,
  PrelinkReactiveTreeOptions,
  PropConstructor<any>,
  PropOptions<any>,
  PropType<any>,
  SetDataDebugInfo,
  SetDataSnapshotOptions,
  SetupContext<any, any, any>,
  SetupContextNativeInstance,
  SetupFunction<any, any, any, any>,
  ShallowUnwrapRef<any>,
  TriggerEventOptions,
  VNode,
  VNodeProps,
  WevuPlugin,
]

declare const typeCoverage: _TypeCoverage
expectType<_TypeCoverage>(typeCoverage)
