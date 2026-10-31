import type { WechatMiniprogram } from '@weapp-core/types/wechat-api'
import type { HostMiniProgramNavigateToOption } from 'wevu'
import { expectAssignable, expectType } from 'tsd'
import { useSelectorQuery } from 'wevu'

expectAssignable<HostMiniProgramNavigateToOption>({ url: '/pages/index/index' })
expectType<WechatMiniprogram.SelectorQuery | null>(useSelectorQuery()())

// @ts-expect-error 模块类型入口不得声明全局 Page。
void Page
// @ts-expect-error 模块类型入口不得声明全局 Behavior。
void Behavior
// @ts-expect-error 模块类型入口不得声明全局 wx。
void wx
