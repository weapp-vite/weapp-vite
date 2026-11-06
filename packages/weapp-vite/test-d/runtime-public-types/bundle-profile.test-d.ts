import type { createCompilerContext } from 'weapp-vite'
import { expectAssignable, expectError, expectType } from 'tsd'

type CompilerContext = Awaited<ReturnType<typeof createCompilerContext>>
type HmrState = CompilerContext['runtimeState']['build']['hmr']
type BundleProfileKeys = 'vueGenerateBundleMs' | 'vueBundleRefreshMs' | 'vueBundleAssetsMs'
  | 'generateRewritePrepareMs' | 'generateRewriteAnalysisMs' | 'generateRewriteNpmMs'
  | 'generateRewritePlatformMs' | 'generateRewriteRequestGlobalsMs' | 'generateRewritePreludeMs'
  | 'generateRewriteRuntimeMs' | 'vueBundleEligibleCount' | 'vueBundleEmittedCount'
  | 'vueBundleCacheHitCount' | 'vueBundleRecompileCount' | 'vueBundleStyleOnlyCount'
  | 'vueBundleFallbackCount' | 'rewriteAnalysisCacheHitCount' | 'rewriteAnalysisCacheMissCount'
type BundleProfile = Pick<HmrState['profile'], BundleProfileKeys>
type RecentBundleProfile = Pick<HmrState['recentProfiles'][number], BundleProfileKeys>

declare const profile: HmrState['profile'] | HmrState['recentProfiles'][number]

expectType<number | undefined>(profile.vueGenerateBundleMs)
expectType<number | undefined>(profile.vueBundleRefreshMs)
expectType<number | undefined>(profile.vueBundleAssetsMs)
expectType<number | undefined>(profile.generateRewritePrepareMs)
expectType<number | undefined>(profile.generateRewriteAnalysisMs)
expectType<number | undefined>(profile.generateRewriteNpmMs)
expectType<number | undefined>(profile.generateRewritePlatformMs)
expectType<number | undefined>(profile.generateRewriteRequestGlobalsMs)
expectType<number | undefined>(profile.generateRewritePreludeMs)
expectType<number | undefined>(profile.generateRewriteRuntimeMs)
expectType<number | undefined>(profile.vueBundleEligibleCount)
expectType<number | undefined>(profile.vueBundleEmittedCount)
expectType<number | undefined>(profile.vueBundleCacheHitCount)
expectType<number | undefined>(profile.vueBundleRecompileCount)
expectType<number | undefined>(profile.vueBundleStyleOnlyCount)
expectType<number | undefined>(profile.vueBundleFallbackCount)
expectType<number | undefined>(profile.rewriteAnalysisCacheHitCount)
expectType<number | undefined>(profile.rewriteAnalysisCacheMissCount)
expectAssignable<BundleProfile>({})
expectAssignable<RecentBundleProfile>({})
expectAssignable<BundleProfile>({ vueGenerateBundleMs: 0, rewriteAnalysisCacheHitCount: 1 })
expectError<BundleProfile>({ vueBundleRefreshMs: 'slow' })
expectError<RecentBundleProfile>({ rewriteAnalysisCacheMissCount: 'miss' })
