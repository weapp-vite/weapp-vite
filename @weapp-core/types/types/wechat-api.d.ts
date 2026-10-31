// namespace 的普通声明重导出保留 export import 兼容性；此入口仅提供类型。
export { WechatMiniprogram } from '../dist/.generated/platform-types/wechat.mjs'
export type {
  WechatBehaviorConstructor,
  WechatMiniProgramApi,
  WechatPageConstructor,
} from '../dist/wechat-api.mjs'
