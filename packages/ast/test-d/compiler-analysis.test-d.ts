import type { NativeCompilerRegisteredComponent, NativeCompilerScriptAnalysis, NativeCompilerScriptImport, NativeCompilerScriptInput, NativeCompilerScriptSpan } from '@weapp-vite/ast'
import { analyzeCompilerScriptsWithNative } from '@weapp-vite/ast'
import { expectError, expectNotAssignable, expectType } from 'tsd'

const input: NativeCompilerScriptInput = { code: 'defineOptions({})', filename: 'page.ts' }
const pageInput: NativeCompilerScriptInput = {
  code: 'import { onResize } from \'wevu/router\'; onResize(() => {})',
  filename: 'page.ts',
  pageFeatureModules: ['wevu/router'],
  pageFeatureHookToFeatureJson: JSON.stringify({ onResize: 'enableOnResize' }),
}
const results = analyzeCompilerScriptsWithNative([input])
expectType<Array<NativeCompilerScriptAnalysis | null> | undefined>(results)
expectType<Array<NativeCompilerScriptAnalysis | null> | undefined>(analyzeCompilerScriptsWithNative([pageInput]))
const summary = results?.[0]
if (summary) {
  expectType<NativeCompilerScriptSpan[]>(summary.defineOptionsStatements)
  expectType<NativeCompilerScriptImport[]>(summary.imports)
  expectType<boolean | undefined>(summary.hasDefaultExport)
  expectType<NativeCompilerRegisteredComponent[] | undefined>(summary.registeredComponents)
  expectType<string[] | undefined>(summary.pageFeatureFlags)
  expectType<{ warningOffset?: number } | undefined>(summary.reservedPropsDiagnostic)
  expectType<number | undefined>(summary.reservedPropsDiagnostic?.warningOffset)
  expectType<number>(summary.defineOptionsStatements[0]!.start)
  expectType<number>(summary.defineOptionsStatements[0]!.end)
}
expectError(analyzeCompilerScriptsWithNative([{ code: 1 }]))
expectError(analyzeCompilerScriptsWithNative([{ code: '', moduleId: 'wevu' }]))
expectNotAssignable<NativeCompilerScriptAnalysis>(summary)
expectNotAssignable<NativeCompilerScriptAnalysis['hasDefaultExport']>('true')
expectNotAssignable<NativeCompilerScriptAnalysis['reservedPropsDiagnostic']>({ warningOffset: '1' })
