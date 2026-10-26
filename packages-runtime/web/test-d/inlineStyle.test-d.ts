import type { ResolvedStyleUnitOptions } from '@weapp-vite/web'
import { initializePageRoutes, transformInlineStyleValue } from '@weapp-vite/web'
import { transformInlineStyleValue as runtimeTransform } from '@weapp-vite/web/runtime'
import { nothing } from 'lit'
import { expectError, expectType } from 'tsd'

expectType<string>(transformInlineStyleValue('width:20rpx'))
expectType<string>(transformInlineStyleValue([{ width: '20rpx' }, 'height:10rpx']))
expectType<string>(runtimeTransform({ '--customUnit': '10rpx' }))
expectType<string>(transformInlineStyleValue({ width: '20rpx' }))
expectType<undefined>(transformInlineStyleValue(undefined))
expectType<null>(transformInlineStyleValue(null))
expectType<false>(transformInlineStyleValue(false))
expectType<12>(transformInlineStyleValue(12))
expectType<typeof nothing>(transformInlineStyleValue(nothing))

const options: ResolvedStyleUnitOptions = { useVariable: false, ratio: 0.25, rpxVar: '--unit', designWidth: 750 }
expectType<void>(initializePageRoutes([], { styleUnits: options }))
expectError(initializePageRoutes([], { styleUnits: { ...options, ratio: '0.25' } }))
expectError(initializePageRoutes([], { styleUnits: { ratio: 0.25 } }))
expectError(transformInlineStyleValue('width:20rpx', options))
