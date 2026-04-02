/* eslint-disable ts/no-empty-object-type -- 允许空对象类型占位 */
import type {
  AllowedComponentProps as VueAllowedComponentProps,
  ComponentCustomProps as VueComponentCustomProps,
  ComponentOptionsMixin as VueComponentOptionsMixin,
  ComputedOptions as VueComputedOptions,
  DefineComponent as VueDefineComponent,
  EmitsOptions as VueEmitsOptions,
  MethodOptions as VueMethodOptions,
  ObjectDirective as VueObjectDirective,
  PublicProps as VuePublicProps,
  Ref as VueRef,
  ShallowRef as VueShallowRef,
  ShallowUnwrapRef as VueShallowUnwrapRef,
  SlotsType as VueSlotsType,
  VNode as VueVNode,
  VNodeProps as VueVNodeProps,
} from 'vue'
import type { ComponentPropsOptions, ExtractDefaultPropTypes, ExtractPropTypes } from './runtime/types/props'

export type Ref<T = any, S = T> = VueRef<T, S>
export type ShallowRef<T = any, S = T> = VueShallowRef<T, S>

export type AllowedComponentProps = VueAllowedComponentProps
export type ComponentCustomProps = VueComponentCustomProps
export type ComponentOptionsMixin = VueComponentOptionsMixin
export type DefineComponent<
  PropsOrPropOptions = ComponentPropsOptions,
  RawBindings = Record<string, any>,
  D = Record<string, any>,
  C extends VueComputedOptions = VueComputedOptions,
  M extends VueMethodOptions = VueMethodOptions,
  Mixin extends VueComponentOptionsMixin = VueComponentOptionsMixin,
  Extends extends VueComponentOptionsMixin = VueComponentOptionsMixin,
  E extends VueEmitsOptions = VueEmitsOptions,
  EE extends string = string,
  PP = VuePublicProps,
  Props = PropsOrPropOptions extends ComponentPropsOptions
    ? ExtractPropTypes<PropsOrPropOptions>
    : PropsOrPropOptions,
  Defaults = PropsOrPropOptions extends ComponentPropsOptions
    ? ExtractDefaultPropTypes<PropsOrPropOptions>
    : {},
  S extends VueSlotsType = VueSlotsType,
> = VueDefineComponent<
  PropsOrPropOptions,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  PP,
  Props,
  Defaults,
  S
>

export type NativeComponent<Props = Record<string, any>> = new (...args: any[]) => InstanceType<
  DefineComponent<
    {},
    {},
    {},
    {},
    {},
    VueComponentOptionsMixin,
    VueComponentOptionsMixin,
    {},
    string,
    VuePublicProps,
    Props,
    {}
  >
>

export type ObjectDirective<
  HostElement = any,
  Value = any,
  Modifiers extends string = string,
  Arg = any,
> = VueObjectDirective<HostElement, Value, Modifiers, Arg>
export type PublicProps = VuePublicProps
export type ShallowUnwrapRef<T> = VueShallowUnwrapRef<T>
export type VNode<HostNode = any, HostElement = any, ExtraProps = Record<string, any>> = VueVNode<
  HostNode,
  HostElement,
  ExtraProps
>
export type VNodeProps = VueVNodeProps
