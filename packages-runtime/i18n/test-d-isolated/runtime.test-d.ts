/* eslint ts/no-require-imports: ["error", { allowAsImport: true }] -- 隔离环境同时验证 import 与 require 声明 */
import type { WechatBehaviorConstructor, WechatPageConstructor } from '@weapp-core/types/wechat-api'
import type { I18nBehavior, I18nHost, I18nInstance, I18nOptions } from '@weapp-vite/i18n'
import process from 'node:process'
import { createI18n } from '@weapp-vite/i18n'
import runtime = require('@weapp-vite/i18n/runtime')
import { expectType } from 'tsd'

declare const options: I18nOptions
declare const host: I18nHost

const instance = createI18n(options, host)
const requiredInstance = runtime.createI18n(options, host)

expectType<I18nInstance>(instance)
expectType<I18nInstance>(requiredInstance)
expectType<WechatBehaviorConstructor>(host.Behavior)
expectType<WechatPageConstructor>(host.Page)
expectType<WechatPageConstructor>(instance.page)
expectType<I18nBehavior>(instance.behavior)

instance.page({
  data: { count: 0 },
  onLoad() {
    expectType<number>(this.data.count)
  },
})

expectType<Document>(document)
expectType<NodeJS.Process>(process)
// @ts-expect-error 公开声明不得注入微信运行时全局。
void wx
// @ts-expect-error 公开声明不得注入 Page 全局。
void Page
// @ts-expect-error 公开声明不得注入 Behavior 全局。
void Behavior
