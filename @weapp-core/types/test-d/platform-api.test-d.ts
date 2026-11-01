/// <reference types="miniprogram-api-typings" />
/* eslint-disable import/no-duplicates -- 分别验证 NodeNext 的 import 与 require 类型解析分支。 */
import type { WechatMiniprogram as ScopedWechat, WechatBehaviorConstructor, WechatMiniProgramApi, WechatPageConstructor } from '@weapp-core/types/wechat-api'
import type { WechatPageConstructor as CommonJsPageConstructor } from '@weapp-core/types/wechat-api' with { 'resolution-mode': 'require' }
import { expectType } from 'tsd'

declare const adapter: WechatMiniProgramApi
declare const page: WechatPageConstructor
declare const behavior: WechatBehaviorConstructor
declare const nativeInstance: WechatMiniprogram.Component.TrivialInstance
declare const scopedInstance: ScopedWechat.Component.TrivialInstance
declare const nativeQuery: WechatMiniprogram.SelectorQuery
declare const scopedQuery: ScopedWechat.SelectorQuery

expectType<typeof wx>(adapter)
expectType<typeof Page>(page)
expectType<typeof Page>({} as CommonJsPageConstructor)
expectType<typeof Behavior>(behavior)
expectType<typeof Behavior>({} as ScopedWechat.Behavior.Constructor)
expectType<typeof Component>({} as ScopedWechat.Component.Constructor)
expectType<WechatMiniprogram.Component.TrivialInstance>(scopedInstance)
expectType<ScopedWechat.Component.TrivialInstance>(nativeInstance)
expectType<WechatMiniprogram.SelectorQuery>(scopedQuery)
expectType<ScopedWechat.SelectorQuery>(nativeQuery)

type BehaviorIdentifier = ReturnType<typeof behavior<ScopedWechat.IAnyObject, ScopedWechat.IAnyObject, ScopedWechat.IAnyObject, []>>
expectType<WechatMiniprogram.Behavior.Identifier<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject, []>>({} as BehaviorIdentifier)
