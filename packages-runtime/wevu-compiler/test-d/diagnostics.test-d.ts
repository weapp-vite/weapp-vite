import type {
  CompilerDiagnostic,
  CompilerDiagnosticCode,
  SourceSpan,
} from '@wevu/compiler'
import { compileSfc, compileTemplate } from '@wevu/compiler'
import { expectType } from 'tsd'

const templateResult = compileTemplate(
  '<view v-html="html" />',
  '/project/src/pages/index.vue',
)
expectType<CompilerDiagnostic[]>(templateResult.diagnostics)
expectType<CompilerDiagnosticCode>('WV1001')
expectType<SourceSpan | undefined>(templateResult.diagnostics[0]?.loc)

compileSfc(
  '<template><view v-html="html" /></template>',
  '/project/src/pages/index.vue',
).then((sfcResult) => {
  expectType<CompilerDiagnostic[] | undefined>(sfcResult.diagnostics)
})
