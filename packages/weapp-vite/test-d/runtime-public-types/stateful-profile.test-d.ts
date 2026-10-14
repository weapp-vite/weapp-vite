import type { createCompilerContext } from 'weapp-vite'
import { expectAssignable, expectType } from 'tsd'

type CompilerContext = Awaited<ReturnType<typeof createCompilerContext>>
type SourceChange = NonNullable<CompilerContext['onStatefulHmrSourceChange']>

declare const context: CompilerContext
declare const notify: SourceChange

expectAssignable<SourceChange>((_file: string, _reasons: string[]) => {})
expectType<void>(notify('src/page.vue', []))
expectType<void>(notify('src/page.vue', ['entry-direct:1'], {
  eventId: 'source-ingress',
  event: 'update',
  file: 'src/page.vue',
  receivedAtMs: 10,
}))
expectType<void | undefined>(context.onStatefulHmrSourceChange?.('src/page.vue', []))
