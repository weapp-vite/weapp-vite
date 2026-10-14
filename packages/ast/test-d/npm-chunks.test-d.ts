import type {
  NativeNpmChunkAnalysis,
  NativeNpmChunkAnalysisInput,
  NativeNpmLocalRootFact,
  NativeNpmPlatformApiFact,
  NativeNpmRequireFact,
} from '@weapp-vite/ast'
import { analyzeNpmChunksWithNative } from '@weapp-vite/ast'
import { expectError, expectNotAssignable, expectType } from 'tsd'

const input: NativeNpmChunkAnalysisInput = { code: `require('pkg')`, filename: 'chunk.js' }
const results = analyzeNpmChunksWithNative([input])
expectType<Array<NativeNpmChunkAnalysis | null> | undefined>(results)
const summary = results?.[0]
if (summary) {
  expectType<NativeNpmRequireFact[]>(summary.requires)
  expectType<NativeNpmPlatformApiFact[]>(summary.platformApiRanges)
  expectType<NativeNpmLocalRootFact[]>(summary.localRootFacts)
  expectType<number>(summary.requires[0]!.start)
  expectType<number>(summary.requires[0]!.end)
  expectType<string>(summary.requires[0]!.importee)
  expectType<'alias' | 'require' | 'interop'>(summary.localRootFacts[0]!.kind)
  expectType<number | undefined>(summary.localRootFacts[0]!.requireIndex)
  expectType<string | undefined>(summary.localRootFacts[0]!.referenceName)
  expectType<number | undefined>(summary.localRootFacts[0]!.secondArgumentStart)
}
expectError(analyzeNpmChunksWithNative([{ code: 1 }]))
expectError(analyzeNpmChunksWithNative([{ code: '', filename: 1 }]))
expectError(analyzeNpmChunksWithNative({ code: '' }))
expectNotAssignable<NativeNpmChunkAnalysis>(summary)
expectNotAssignable<NativeNpmLocalRootFact>({ kind: 'unsupported' })
