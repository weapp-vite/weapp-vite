import type { JsonMergeContext, StaticPageDeclaration, StaticPageMeta } from '@wevu/compiler'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

declare const context: JsonMergeContext
expectType<StaticPageDeclaration | undefined>(context.routeConfig)
expectType<StaticPageMeta | undefined>(context.pageMeta)
expectAssignable<JsonMergeContext>({ stage: 'emit' })
expectAssignable<JsonMergeContext>({ stage: 'macro', routeConfig: { name: 'home', meta: { title: '首页' } }, pageMeta: { layout: false, nested: { enabled: true } } })

expectNotAssignable<StaticPageMeta>({ layout: () => 'dynamic' })
