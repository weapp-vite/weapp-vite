/* eslint-disable ts/no-namespace -- 通过单点 namespace 兼容宿主类型源，避免纯类型 namespace 在多文件间转发时被 bundler 误判为运行时导出。 */
export declare namespace WechatMiniProgramHostNamespace {
  export import App = WechatMiniprogram.App
  export import Behavior = WechatMiniprogram.Behavior
  export import Component = WechatMiniprogram.Component
  export import Page = WechatMiniprogram.Page
  export import BoundingClientRectCallbackResult = WechatMiniprogram.BoundingClientRectCallbackResult
  export import ScrollOffsetCallbackResult = WechatMiniprogram.ScrollOffsetCallbackResult
  export import NodesRef = WechatMiniprogram.NodesRef
  export import SelectorQuery = WechatMiniprogram.SelectorQuery
  export import CreateIntersectionObserverOption = WechatMiniprogram.CreateIntersectionObserverOption
  export import IntersectionObserver = WechatMiniprogram.IntersectionObserver
  export import OnUnhandledRejectionListenerResult = WechatMiniprogram.OnUnhandledRejectionListenerResult
  export import OnThemeChangeListenerResult = WechatMiniprogram.OnThemeChangeListenerResult
  export import OnMemoryWarningListenerResult = WechatMiniprogram.OnMemoryWarningListenerResult
  export import SwitchTabOption = WechatMiniprogram.SwitchTabOption
  export import ReLaunchOption = WechatMiniprogram.ReLaunchOption
  export import RedirectToOption = WechatMiniprogram.RedirectToOption
  export import NavigateToOption = WechatMiniprogram.NavigateToOption
}

export declare namespace AlipayMiniProgramHostNamespace {}

export declare namespace DouyinMiniProgramHostNamespace {}

export declare namespace TtMiniProgramHostNamespace {}

export declare namespace DefaultMiniProgramHostNamespace {
  export import App = WechatMiniProgramHostNamespace.App
  export import Behavior = WechatMiniProgramHostNamespace.Behavior
  export import Component = WechatMiniProgramHostNamespace.Component
  export import Page = WechatMiniProgramHostNamespace.Page
  export import BoundingClientRectCallbackResult = WechatMiniProgramHostNamespace.BoundingClientRectCallbackResult
  export import ScrollOffsetCallbackResult = WechatMiniProgramHostNamespace.ScrollOffsetCallbackResult
  export import NodesRef = WechatMiniProgramHostNamespace.NodesRef
  export import SelectorQuery = WechatMiniProgramHostNamespace.SelectorQuery
  export import CreateIntersectionObserverOption = WechatMiniProgramHostNamespace.CreateIntersectionObserverOption
  export import IntersectionObserver = WechatMiniProgramHostNamespace.IntersectionObserver
  export import OnUnhandledRejectionListenerResult = WechatMiniProgramHostNamespace.OnUnhandledRejectionListenerResult
  export import OnThemeChangeListenerResult = WechatMiniProgramHostNamespace.OnThemeChangeListenerResult
  export import OnMemoryWarningListenerResult = WechatMiniProgramHostNamespace.OnMemoryWarningListenerResult
  export import SwitchTabOption = WechatMiniProgramHostNamespace.SwitchTabOption
  export import ReLaunchOption = WechatMiniProgramHostNamespace.ReLaunchOption
  export import RedirectToOption = WechatMiniProgramHostNamespace.RedirectToOption
  export import NavigateToOption = WechatMiniProgramHostNamespace.NavigateToOption
}

export declare namespace MiniProgramHostNamespace {
  export import App = DefaultMiniProgramHostNamespace.App
  export import Behavior = DefaultMiniProgramHostNamespace.Behavior
  export import Component = DefaultMiniProgramHostNamespace.Component
  export import Page = DefaultMiniProgramHostNamespace.Page
  export import BoundingClientRectCallbackResult = DefaultMiniProgramHostNamespace.BoundingClientRectCallbackResult
  export import ScrollOffsetCallbackResult = DefaultMiniProgramHostNamespace.ScrollOffsetCallbackResult
  export import NodesRef = DefaultMiniProgramHostNamespace.NodesRef
  export import SelectorQuery = DefaultMiniProgramHostNamespace.SelectorQuery
  export import CreateIntersectionObserverOption = DefaultMiniProgramHostNamespace.CreateIntersectionObserverOption
  export import IntersectionObserver = DefaultMiniProgramHostNamespace.IntersectionObserver
  export import OnUnhandledRejectionListenerResult = DefaultMiniProgramHostNamespace.OnUnhandledRejectionListenerResult
  export import OnThemeChangeListenerResult = DefaultMiniProgramHostNamespace.OnThemeChangeListenerResult
  export import OnMemoryWarningListenerResult = DefaultMiniProgramHostNamespace.OnMemoryWarningListenerResult
  export import SwitchTabOption = DefaultMiniProgramHostNamespace.SwitchTabOption
  export import ReLaunchOption = DefaultMiniProgramHostNamespace.ReLaunchOption
  export import RedirectToOption = DefaultMiniProgramHostNamespace.RedirectToOption
  export import NavigateToOption = DefaultMiniProgramHostNamespace.NavigateToOption
}

export type MiniProgramPlatformHostSourceName = 'default' | 'wechat' | 'alipay' | 'douyin'
export type MiniProgramRuntimeHostSourceName = 'wx' | 'my' | 'tt'
export type MiniProgramHostSourceName = MiniProgramPlatformHostSourceName | MiniProgramRuntimeHostSourceName

export interface DefaultMiniProgramHostSourceContract {
  BoundingClientRectCallbackResult: DefaultMiniProgramHostNamespace.BoundingClientRectCallbackResult
  ScrollOffsetCallbackResult: DefaultMiniProgramHostNamespace.ScrollOffsetCallbackResult
  NodesRef: DefaultMiniProgramHostNamespace.NodesRef
  SelectorQuery: DefaultMiniProgramHostNamespace.SelectorQuery
  CreateIntersectionObserverOption: DefaultMiniProgramHostNamespace.CreateIntersectionObserverOption
  IntersectionObserver: DefaultMiniProgramHostNamespace.IntersectionObserver
  OnUnhandledRejectionListenerResult: DefaultMiniProgramHostNamespace.OnUnhandledRejectionListenerResult
  OnThemeChangeListenerResult: DefaultMiniProgramHostNamespace.OnThemeChangeListenerResult
  OnMemoryWarningListenerResult: DefaultMiniProgramHostNamespace.OnMemoryWarningListenerResult
  SwitchTabOption: DefaultMiniProgramHostNamespace.SwitchTabOption
  ReLaunchOption: DefaultMiniProgramHostNamespace.ReLaunchOption
  RedirectToOption: DefaultMiniProgramHostNamespace.RedirectToOption
  NavigateToOption: DefaultMiniProgramHostNamespace.NavigateToOption
}

export interface WechatMiniProgramHostSourceContract {
  BoundingClientRectCallbackResult: WechatMiniProgramHostNamespace.BoundingClientRectCallbackResult
  ScrollOffsetCallbackResult: WechatMiniProgramHostNamespace.ScrollOffsetCallbackResult
  NodesRef: WechatMiniProgramHostNamespace.NodesRef
  SelectorQuery: WechatMiniProgramHostNamespace.SelectorQuery
  CreateIntersectionObserverOption: WechatMiniProgramHostNamespace.CreateIntersectionObserverOption
  IntersectionObserver: WechatMiniProgramHostNamespace.IntersectionObserver
  OnUnhandledRejectionListenerResult: WechatMiniProgramHostNamespace.OnUnhandledRejectionListenerResult
  OnThemeChangeListenerResult: WechatMiniProgramHostNamespace.OnThemeChangeListenerResult
  OnMemoryWarningListenerResult: WechatMiniProgramHostNamespace.OnMemoryWarningListenerResult
  SwitchTabOption: WechatMiniProgramHostNamespace.SwitchTabOption
  ReLaunchOption: WechatMiniProgramHostNamespace.ReLaunchOption
  RedirectToOption: WechatMiniProgramHostNamespace.RedirectToOption
  NavigateToOption: WechatMiniProgramHostNamespace.NavigateToOption
}

/**
 * @description 支付宝宿主类型契约占位；后续接入稳定 typings 时在此扩展。
 */
export interface AlipayMiniProgramHostSourceContract extends Record<never, never> {}

/**
 * @description 抖音宿主类型契约占位；后续接入稳定 typings 时在此扩展。
 */
export interface DouyinMiniProgramHostSourceContract extends Record<never, never> {}

/**
 * @description `tt` 命名兼容入口，保持与抖音宿主语义主名一致。
 */
export interface TtMiniProgramHostSourceContract extends DouyinMiniProgramHostSourceContract {}

export interface MiniProgramPlatformHostSourceRegistry {
  default: DefaultMiniProgramHostSourceContract
  wechat: WechatMiniProgramHostSourceContract
  alipay: AlipayMiniProgramHostSourceContract
  douyin: DouyinMiniProgramHostSourceContract
}

export interface MiniProgramRuntimeHostSourceRegistry {
  wx: WechatMiniProgramHostSourceContract
  my: AlipayMiniProgramHostSourceContract
  tt: TtMiniProgramHostSourceContract
}

export interface MiniProgramHostSourceRegistry extends MiniProgramPlatformHostSourceRegistry, MiniProgramRuntimeHostSourceRegistry {}

export type MiniProgramPlatformHostNamespaceBySource<
  TSourceName extends MiniProgramPlatformHostSourceName = MiniProgramPlatformHostSourceName,
> = MiniProgramPlatformHostSourceRegistry[TSourceName]

export type MiniProgramRuntimeHostNamespaceBySource<
  TSourceName extends MiniProgramRuntimeHostSourceName = MiniProgramRuntimeHostSourceName,
> = MiniProgramRuntimeHostSourceRegistry[TSourceName]

export type MiniProgramHostNamespaceBySource<TSourceName extends MiniProgramHostSourceName = MiniProgramHostSourceName>
  = MiniProgramHostSourceRegistry[TSourceName]
