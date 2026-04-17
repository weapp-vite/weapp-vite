import type { DefaultMiniProgramHostNamespace } from './miniprogramHostDefault'
import type { WechatMiniProgramHostNamespace } from './miniprogramHostWechat'

export { AlipayMiniProgramHostNamespace } from './miniprogramHostAlipay'
export { DefaultMiniProgramHostNamespace } from './miniprogramHostDefault'
export { DouyinMiniProgramHostNamespace, TtMiniProgramHostNamespace } from './miniprogramHostTt'
export { WechatMiniProgramHostNamespace } from './miniprogramHostWechat'

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
