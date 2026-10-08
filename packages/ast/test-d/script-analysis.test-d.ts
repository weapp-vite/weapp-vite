import type { ScriptAnalysisResult } from '@weapp-vite/ast'
import { analyzeScript, analyzeScripts, collectOnPageScrollPerformanceWarnings } from '@weapp-vite/ast'
import { expectError, expectType } from 'tsd'

const featureFlags = { moduleId: 'wevu', hookToFeature: { onPageScroll: 'scroll' as const } }
const analysis = analyzeScript('onPageScroll(() => {})', { featureFlags })
expectType<ScriptAnalysisResult<'scroll'>>(analysis)
expectType<Array<ScriptAnalysisResult<'scroll'>>>(analyzeScripts([{ code: 'wx.request()' }], { featureFlags }))
expectType<string[]>(collectOnPageScrollPerformanceWarnings('onPageScroll(() => {})', 'page.ts', { engine: 'oxc' }))
expectError(analysis.onPageScrollDiagnostics)
