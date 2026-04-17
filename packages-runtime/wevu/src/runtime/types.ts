import type {
  MiniProgramBoundingClientRectResult,
  MiniProgramNodesRefFields,
  MiniProgramScrollOffsetResult,
} from './types/miniprogram'

export type {
  AllowedComponentProps,
  ComponentCustomProps,
  ComponentOptionsMixin,
  DefineComponent,
  NativeComponent,
  ObjectDirective,
  PublicProps,
  ShallowUnwrapRef,
  VNode,
  VNodeProps,
} from '../vue-types'
export type {
  ComponentPublicInstance,
  ComputedDefinitions,
  ExtractComputed,
  ExtractMethods,
  MethodDefinitions,
  ModelBinding,
  ModelBindingOptions,
  ModelBindingPayload,
} from './types/core'
export type {
  MiniProgramAdapter,
  MiniProgramAddToFavoritesOption,
  MiniProgramAppOptions,
  MiniProgramBehaviorIdentifier,
  MiniProgramBoundingClientRectResult,
  MiniProgramComponentAllFullProperty,
  MiniProgramComponentAllProperty,
  MiniProgramComponentBehaviorOptions,
  MiniProgramComponentEmptyArray,
  MiniProgramComponentInstance,
  MiniProgramComponentMethodOption,
  MiniProgramComponentOptions,
  MiniProgramComponentPropertyOption,
  MiniProgramComponentPropertyValue,
  MiniProgramComponentRawOptions,
  MiniProgramComponentShortProperty,
  MiniProgramInstance,
  MiniProgramIntersectionObserver,
  MiniProgramIntersectionObserverOptions,
  MiniProgramLaunchOptions,
  MiniProgramMemoryWarningResult,
  MiniProgramNodesRef,
  MiniProgramNodesRefFields,
  MiniProgramPageLifetime,
  MiniProgramPageLifetimes,
  MiniProgramPageNotFoundOptions,
  MiniProgramPageResizeOption,
  MiniProgramPageScrollOption,
  MiniProgramRouter,
  MiniProgramSaveExitState,
  MiniProgramScrollOffsetResult,
  MiniProgramSelectorQuery,
  MiniProgramShareAppMessageOption,
  MiniProgramTabItemTapOption,
  MiniProgramThemeChangeResult,
  MiniProgramUnhandledRejectionResult,
  TriggerEventOptions,
} from './types/miniprogram'
export type { CreateAppOptions, DataOption, DefineAppOptions, DefineComponentOptions, PageFeatures } from './types/options'
export type {
  ComponentPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
  ExtractPublicPropTypes,
  InferNativeProps,
  InferNativePropType,
  InferProps,
  InferPropType,
  MiniProgramRouterNavigateToOption,
  MiniProgramRouterRedirectToOption,
  MiniProgramRouterReLaunchOption,
  MiniProgramRouterSwitchTabOption,
  NativePropsOptions,
  NativePropType,
  NativeTypedProperty,
  NativeTypeHint,
  PropConstructor,
  PropOptions,
  PropType,
  SetupContext,
  SetupContextNativeInstance,
  SetupContextRouter,
  SetupFunction,
  WevuTypedRouterRouteMap,
} from './types/props'
export type {
  AppConfig,
  InternalRuntimeState,
  InternalRuntimeStateFields,
  RuntimeApp,
  RuntimeInstance,
  WevuPlugin,
} from './types/runtime'

export interface WevuGlobalComponents {}
export interface WevuGlobalDirectives {}
export interface GlobalComponents extends WevuGlobalComponents {}
export interface GlobalDirectives extends WevuGlobalDirectives {}
export interface TemplateRefs {}

export interface TemplateRefValue {
  selector: string
  boundingClientRect: (cb?: (value: MiniProgramBoundingClientRectResult | null) => void) => Promise<MiniProgramBoundingClientRectResult | null>
  scrollOffset: (cb?: (value: MiniProgramScrollOffsetResult | null) => void) => Promise<MiniProgramScrollOffsetResult | null>
  fields: (fields: MiniProgramNodesRefFields, cb?: (value: any) => void) => Promise<any | null>
  node: (cb?: (value: any) => void) => Promise<any | null>
}

export type MiniProgramTemplateRefValue = TemplateRefValue

export type { SetDataDebugInfo, SetDataSnapshotOptions } from './types/setData'
