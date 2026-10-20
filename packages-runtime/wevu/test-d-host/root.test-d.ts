import type { HostMiniProgramNavigateToOption } from 'wevu'
import { expectAssignable, expectType } from 'tsd'
import { useSelectorQuery } from 'wevu'

expectAssignable<HostMiniProgramNavigateToOption>({ url: '/pages/index/index' })
expectType<WechatMiniprogram.SelectorQuery | null>(useSelectorQuery()())
