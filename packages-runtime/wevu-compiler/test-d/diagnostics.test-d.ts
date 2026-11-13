import type {
  CompilerDiagnostic,
  CompilerDiagnosticCode,
  CompilerDiagnosticError,
  SourceSpan,
} from '@wevu/compiler'
import { compileJsxFile, compileSfc, compileTemplate } from '@wevu/compiler'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'

const templateResult = compileTemplate(
  '<view v-html="html" />',
  '/project/src/pages/index.vue',
)
expectType<CompilerDiagnostic[]>(templateResult.diagnostics)
expectType<string | undefined>(templateResult.sourceTags?.[0]?.tag)
expectType<SourceSpan | undefined>(templateResult.sourceTags?.[0]?.loc)
expectAssignable<CompilerDiagnosticCode>('WV1001')
expectAssignable<CompilerDiagnosticCode>('WV1004')
expectAssignable<CompilerDiagnosticCode>('WV1005')
expectAssignable<CompilerDiagnosticCode>('WV1006')
expectAssignable<CompilerDiagnosticCode>('WV1007')
expectAssignable<CompilerDiagnosticCode>('WV1008')
expectAssignable<CompilerDiagnosticCode>('WV1010')
expectAssignable<CompilerDiagnosticCode>('WV1009')
expectAssignable<CompilerDiagnosticCode>('WV2003')
expectNotAssignable<CompilerDiagnosticCode>('WV9999')
expectType<CompilerDiagnosticCode>(templateResult.diagnostics[0]!.code)
expectType<SourceSpan | undefined>(templateResult.diagnostics[0]?.loc)
expectError(templateResult.warnings)

declare const compilerError: CompilerDiagnosticError
expectType<CompilerDiagnosticCode>(compilerError.code)
expectType<string>(compilerError.filename)
expectType<SourceSpan | undefined>(compilerError.loc)
expectType<unknown>(compilerError.cause)

compileSfc(
  '<template><view v-html="html" /></template>',
  '/project/src/pages/index.vue',
).then((sfcResult) => {
  expectType<CompilerDiagnostic[] | undefined>(sfcResult.diagnostics)
  expectType<string | undefined>(sfcResult.meta?.templateTags?.[0]?.filename)
  expectType<SourceSpan | undefined>(sfcResult.meta?.templateTags?.[0]?.loc)
})

compileJsxFile(
  'export default { render() { return <Teleport /> } }',
  '/project/src/pages/index.tsx',
).then((jsxResult) => {
  expectType<CompilerDiagnostic[] | undefined>(jsxResult.diagnostics)
})

compileJsxFile('export default { render() { return <Teleport to={target} /> } }', 'src/pages/index.tsx', {
  template: { teleport: { unsupported: 'error' } },
}).then((result) => {
  expectType<CompilerDiagnostic[] | undefined>(result.diagnostics)
})
