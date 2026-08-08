import type { ResolverObject, UviewPlusResolverOptions } from 'weapp-vite/resolvers'
import { expectAssignable, expectType } from 'tsd'
import { UviewPlusResolver } from 'weapp-vite/resolvers'

expectAssignable<UviewPlusResolverOptions>({})
expectAssignable<UviewPlusResolverOptions>({ supportFilesStrategy: 'used' })
expectAssignable<UviewPlusResolverOptions>({ supportFilesStrategy: 'full' })
expectType<ResolverObject>(UviewPlusResolver())
expectType<ResolverObject>(UviewPlusResolver({ supportFilesStrategy: 'full' }))
