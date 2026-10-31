import type {
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiDouyinMiniProgramRawAdapterSource,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiWechatMiniProgramRawAdapterSource,
} from '@weapp-core/api'
import type * as Testing from '@weapp-core/api/vitest'
import type * as Setup from '@weapp-core/api/vitest/setup'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

declare const wechat: WeapiWechatMiniProgramRawAdapterSource
declare const alipay: WeapiAlipayMiniProgramRawAdapterSource
declare const douyin: WeapiDouyinMiniProgramRawAdapterSource
declare const testing: typeof Testing
declare const setup: typeof Setup
void testing
void setup

expectAssignable<WeapiMiniProgramRequestOption>({ url: 'https://example.com', method: 'POST' })
expectNotAssignable<WeapiMiniProgramRequestOption>({ url: 1 })
wechat.request({ url: 'https://example.com', success: result => expectType<number>(result.statusCode) })
alipay.getAuthCode({ scopes: ['auth_base'], success: result => expectType<string>(result.authCode) })
douyin.login({ success: result => expectType<string>(result.code) })
declare const response: WeapiMiniProgramRequestSuccessResult
expectType<number>(response.statusCode)

// @ts-expect-error 公共 API 类型不得注入小程序宿主全局。
void App
// @ts-expect-error 公共 API 类型不得注入小程序宿主全局。
void Page
// @ts-expect-error 公共 API 类型不得注入小程序宿主全局。
void Component
// @ts-expect-error 公共 API 类型不得注入小程序宿主全局。
void wx
// @ts-expect-error 公共 API 类型不得注入小程序宿主全局。
void my
// @ts-expect-error 公共 API 类型不得注入小程序宿主全局。
void tt
