export type {
  AllowedComponentProps,
  ComponentCustomProps,
  ComponentOptionsMixin,
  DefineComponent,
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
  MiniProgramAppOptions,
  MiniProgramBehaviorIdentifier,
  MiniProgramComponentBehaviorOptions,
  MiniProgramComponentOptions,
  MiniProgramComponentRawOptions,
  MiniProgramInstance,
  MiniProgramPageLifetimes,
  TriggerEventOptions,
} from './types/miniprogram'
export type { CreateAppOptions, DefineAppOptions, DefineComponentOptions, PageFeatures } from './types/options'
export type {
  ComponentPropsOptions,
  ExtractPropTypes,
  ExtractPublicPropTypes,
  InferProps,
  InferPropType,
  PropConstructor,
  PropOptions,
  PropType,
  SetupContext,
  SetupFunction,
} from './types/props'
export type {
  AppConfig,
  InternalRuntimeState,
  InternalRuntimeStateFields,
  RuntimeApp,
  RuntimeInstance,
  WevuPlugin,
} from './types/runtime'

export interface GlobalComponents {}
export interface GlobalDirectives {}
export interface TemplateRefs {}

type NodesRefFields = Parameters<WechatMiniprogram.NodesRef['fields']>[0]

export interface TemplateRefValue {
  selector: string
  boundingClientRect: (cb?: (value: WechatMiniprogram.BoundingClientRectCallbackResult | null) => void) => Promise<WechatMiniprogram.BoundingClientRectCallbackResult | null>
  scrollOffset: (cb?: (value: WechatMiniprogram.ScrollOffsetCallbackResult | null) => void) => Promise<WechatMiniprogram.ScrollOffsetCallbackResult | null>
  fields: (fields: NodesRefFields, cb?: (value: any) => void) => Promise<any | null>
  node: (cb?: (value: any) => void) => Promise<any | null>
}

export type { SetDataDebugInfo, SetDataSnapshotOptions } from './types/setData'
