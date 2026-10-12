import type { NativeCompilerRegisteredComponent, NativeCompilerScriptAnalysis, NativeCompilerScriptImport, NativeCompilerScriptInput, NativeCompilerScriptSpan } from '@weapp-vite/ast'
import { analyzeCompilerScriptsWithNative } from '@weapp-vite/ast'
import { expectError, expectNotAssignable, expectType } from 'tsd'

const input: NativeCompilerScriptInput = { code: 'defineOptions({})', filename: 'page.ts' }
const results = analyzeCompilerScriptsWithNative([input])
expectType<Array<NativeCompilerScriptAnalysis | null> | undefined>(results)
const summary = results?.[0]
if (summary) {
  expectType<NativeCompilerScriptSpan[]>(summary.defineOptionsStatements)
  expectType<NativeCompilerScriptImport[]>(summary.imports)
  expectType<NativeCompilerRegisteredComponent[] | undefined>(summary.registeredComponents)
  expectType<number>(summary.defineOptionsStatements[0]!.start)
  expectType<number>(summary.defineOptionsStatements[0]!.end)
}
expectError(analyzeCompilerScriptsWithNative([{ code: 1 }]))
expectError(analyzeCompilerScriptsWithNative([{ code: '', moduleId: 'wevu' }]))
expectNotAssignable<NativeCompilerScriptAnalysis>(summary)
