import type { BrowserRendererContext, MiniProgramEventBinding, RuntimeRendererContext } from '..'
import { expectType } from 'tsd'
import { collectMiniProgramEventBindings, resolveMiniProgramEventBinding } from '..'

const collected = collectMiniProgramEventBindings({ catchtap: 'onTap' })
expectType<Map<string, MiniProgramEventBinding>>(collected)
expectType<string | undefined>(collected.get('tap')?.method)
expectType<boolean | undefined>(collected.get('tap')?.stopAfter)
expectType<Map<string, MiniProgramEventBinding>>(collectMiniProgramEventBindings())

const resolved = resolveMiniProgramEventBinding({ catchtap: 'onTap' }, 'tap')
expectType<MiniProgramEventBinding | null>(resolved)
expectType<MiniProgramEventBinding | null>(resolveMiniProgramEventBinding(undefined, 'tap'))
if (resolved) {
  expectType<string>(resolved.method)
  expectType<boolean>(resolved.stopAfter)
}

declare const browserContext: BrowserRendererContext
declare const runtimeContext: RuntimeRendererContext

for (const context of [browserContext, runtimeContext]) {
  const scope = context.componentScopes.get('component:source')
  const bubble = scope?.eventBindings?.get('signal')
  expectType<string | undefined>(bubble?.method)
  expectType<boolean | undefined>(bubble?.stopAfter)
  const capture = scope?.captureEventBindings?.get('signal')
  expectType<string | undefined>(capture?.method)
  expectType<boolean | undefined>(capture?.stopAfter)
}
