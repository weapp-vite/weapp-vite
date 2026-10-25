import type { createCompilerContext } from 'weapp-vite'
import { expectAssignable, expectError, expectType } from 'tsd'

type CompilerContext = Awaited<ReturnType<typeof createCompilerContext>>
declare const context: CompilerContext

for (const queue of [context.buildService.queue, context.runtimeState.build.queue]) {
  expectAssignable<EventTarget>(queue)
  expectType<Promise<number>>(queue.add(async () => 42))
  expectType<void>(queue.addEventListener('completed', (event) => {
    expectType<unknown>(event.detail)
  }, { once: true }))
  expectType<void>(queue.addEventListener('error', (event) => {
    expectType<unknown>(event.detail)
  }))
  expectType<Promise<void>>(queue.onIdle())
  expectError(queue.on('completed', () => {}))
}
