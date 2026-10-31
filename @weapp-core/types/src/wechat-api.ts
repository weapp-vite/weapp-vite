import type { WechatMiniprogram as ScopedWechat } from '../.generated/platform-types/wechat.js'

/* eslint-disable ts/no-namespace -- 空接口探针仅保留显式加载的官方声明身份，不注入运行时全局。 */
declare global {
  namespace WechatMiniprogram {
    interface Wx {}
    namespace Page {
      interface Constructor {}
    }
    namespace Behavior {
      interface Constructor {}
    }
  }
}

/** 消费者已加载官方声明时复用原始身份，否则使用模块内的完整官方签名。 */
export type WechatMiniProgramApi = keyof WechatMiniprogram.Wx extends never
  ? ScopedWechat.Wx
  : WechatMiniprogram.Wx

export type WechatPageConstructor = globalThis.WechatMiniprogram.Page.Constructor extends (...args: any[]) => any
  ? globalThis.WechatMiniprogram.Page.Constructor
  : ScopedWechat.Page.Constructor

export type WechatBehaviorConstructor = globalThis.WechatMiniprogram.Behavior.Constructor extends (...args: any[]) => any
  ? globalThis.WechatMiniprogram.Behavior.Constructor
  : ScopedWechat.Behavior.Constructor

export type { ScopedWechat as WechatMiniprogram }
