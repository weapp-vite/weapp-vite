import type {
  CompilerDiagnostic,
  CompilerDiagnosticCode,
  SourceSpan,
} from '@wevu/compiler'
import { compileJsxFile, compileSfc, compileTemplate } from '@wevu/compiler'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'

const templateResult = compileTemplate(
  '<view v-html="html" />',
  '/project/src/pages/index.vue',
)
expectType<CompilerDiagnostic[]>(templateResult.diagnostics)
expectAssignable<CompilerDiagnosticCode>('WV1001')
expectNotAssignable<CompilerDiagnosticCode>('WV9999')
expectType<CompilerDiagnosticCode>(templateResult.diagnostics[0]!.code)
expectType<SourceSpan | undefined>(templateResult.diagnostics[0]?.loc)
expectError(templateResult.warnings)

compileSfc(
  '<template><view v-html="html" /></template>',
  '/project/src/pages/index.vue',
).then((sfcResult) => {
  expectType<CompilerDiagnostic[] | undefined>(sfcResult.diagnostics)
})

compileJsxFile(
  'export default { render() { return <Teleport /> } }',
  '/project/src/pages/index.tsx',
).then((jsxResult) => {
  expectType<CompilerDiagnostic[] | undefined>(jsxResult.diagnostics)
})
