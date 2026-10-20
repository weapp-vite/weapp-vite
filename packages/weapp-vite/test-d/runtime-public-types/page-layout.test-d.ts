import type { WevuPageLayoutMap as RootLayoutMap } from 'wevu'
import type { WevuPageLayoutMap as PureLayoutMap } from 'wevu/types'
import { expectError, expectType } from 'tsd'
import * as wv from 'weapp-vite'
import { setPageLayout as runtimeSetPageLayout } from 'weapp-vite/runtime'

declare module 'wevu' {
  interface WevuPageLayoutMap {
    dashboard: { title: string }
  }
}

declare const rootMap: RootLayoutMap
declare const pureMap: PureLayoutMap
expectType<RootLayoutMap>(pureMap)
expectType<PureLayoutMap>(rootMap)
expectType<'dashboard'>(null as unknown as keyof PureLayoutMap)
expectType<typeof wv.setPageLayout>(runtimeSetPageLayout)
expectType<void>(wv.setPageLayout('dashboard', { title: 'Console' }))
expectType<void>(wv.setPageLayout(false))
expectError(wv.setPageLayout('missing'))
expectError(wv.setPageLayout('dashboard', { title: 123 }))
