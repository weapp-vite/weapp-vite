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
  ObjectDirective,
  PageFeatures,
  PrelinkReactiveTreeOptions,
  PropConstructor,
  PropOptions,
  PropType,
  SetDataDebugInfo,
  SetDataSnapshotOptions,
  SetupContext,
  SetupFunction,
  ShallowUnwrapRef,
  TriggerEventOptions,
  VNode,
  VNodeProps,
  WevuPlugin,
} from 'wevu'
import type * as wevu from 'wevu'
import type * as CompilerEntry from 'wevu/compiler'
import type { JSX as WevuJsx } from 'wevu/jsx-runtime'
import { expectType } from 'tsd'

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
    | 'onBeforeMount'
    | 'onBeforeUnmount'
    | 'onBeforeUpdate'
    | 'onDeactivated'
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

declare const jsxTypes: WevuJsx
expectType<WevuJsx>(jsxTypes)

type _TypeCoverage = [
  AllowedComponentProps,
  AppConfig,
  ComponentCustomProps,
  ComponentPropsOptions,
  ComputedDefinitions,
  CreateAppOptions<any, any, any>,
  DefineAppOptions<any, any, any>,
  DefineComponent<any, any, any, any, any, any, any, any>,
  DefineComponentOptions<any, any, any, any>,
  ExtractComputed<any>,
  ExtractDefaultPropTypes<any>,
  ExtractMethods<any>,
  ExtractPropTypes<any>,
  ExtractPublicPropTypes<any>,
  InferPropType<any>,
  InferProps<any>,
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
  ObjectDirective<any, any>,
  PageFeatures,
  PrelinkReactiveTreeOptions,
  PropConstructor<any>,
  PropOptions<any>,
  PropType<any>,
  SetDataDebugInfo,
  SetDataSnapshotOptions,
  SetupContext<any, any, any>,
  SetupFunction<any, any, any>,
  ShallowUnwrapRef<any>,
  TriggerEventOptions,
  VNode,
  VNodeProps,
  WevuPlugin,
]

declare const typeCoverage: _TypeCoverage
expectType<_TypeCoverage>(typeCoverage)
