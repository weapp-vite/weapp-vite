import { defineElements, ROUTE_COUPLED_WEB_TAGS, setupRpx, setupWebViewport, WEB_VISUAL_COMPONENT_TAGS } from '@weapp-vite/web/elements'
import { expectAssignable, expectError, expectType } from 'tsd'

expectType<void>(defineElements())
expectType<void>(defineElements(['weapp-view', 'weapp-scroll-view', 'weapp-swiper']))
expectError(defineElements(['weapp-navigator']))
expectError(defineElements(['weapp-unknown']))
expectError(defineElements([{ designWidth: 750 }]))
expectAssignable<readonly string[]>(WEB_VISUAL_COMPONENT_TAGS)
expectAssignable<readonly string[]>(ROUTE_COUPLED_WEB_TAGS)
expectType<void>(setupRpx({ designWidth: 375, varName: '--rpx' }))
expectType<void>(setupRpx())
expectError(setupRpx({ designWidth: '375' }))
expectType<'mini-program' | 'responsive'>(setupWebViewport({ mode: 'responsive' }).mode)
expectType<'mini-program' | 'responsive'>(setupWebViewport().mode)
expectError(setupWebViewport({ mode: 'desktop' }))
expectError(setupWebViewport({ maxWidth: '900' }))
