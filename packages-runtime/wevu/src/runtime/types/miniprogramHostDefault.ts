import { WechatMiniProgramHostNamespace } from './miniprogramHostWechat'

/* eslint-disable ts/no-namespace -- 默认宿主类型源暂时复用微信语义，后续多平台可在此层切换默认实现。 */
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
