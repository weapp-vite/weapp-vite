import type { createCompilerContext } from 'weapp-vite'
import { expectAssignable, expectType } from 'tsd'

type CompilerContext = Awaited<ReturnType<typeof createCompilerContext>>
type CloseAll = CompilerContext['watcherService']['closeAll']

declare const context: CompilerContext

expectType<void | Promise<void>>(context.watcherService.closeAll())
expectAssignable<CloseAll>(() => {})
expectAssignable<CloseAll>(async () => {})

export async function closeCompilerWatchers() {
  expectType<void>(await context.watcherService.closeAll())
}
