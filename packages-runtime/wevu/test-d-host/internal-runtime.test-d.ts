import type { WechatMiniprogram } from '@weapp-core/types/wechat-api'
import { expectType } from 'tsd'
import { installJsxIslands, useSelectorQuery } from 'wevu/internal-runtime'

expectType<void>(installJsxIslands())
expectType<WechatMiniprogram.SelectorQuery | null>(useSelectorQuery()())

// @ts-expect-error 模块类型入口不得声明全局 Page。
void Page
// @ts-expect-error 模块类型入口不得声明全局 Behavior。
void Behavior
// @ts-expect-error 模块类型入口不得声明全局 wx。
void wx
