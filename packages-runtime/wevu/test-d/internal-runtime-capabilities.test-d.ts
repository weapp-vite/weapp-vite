import type { RuntimeCapabilityName, RuntimeCapabilityRegistry } from 'wevu/internal-runtime'
import { WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'
import { installJsxIslands as installDevJsxIslands } from 'wevu/dev/internal-runtime'
import { createWevuScopedSlotComponent, installJsxIslands } from 'wevu/internal-runtime'

expectType<void>(installJsxIslands())
expectType<typeof installJsxIslands>(installDevJsxIslands)
expectAssignable<RuntimeCapabilityName>('jsxIslands')

declare const registry: RuntimeCapabilityRegistry
declare const methods: Record<string, (...args: any[]) => any>
expectType<void | undefined>(registry.jsxIslands?.attachMethods(methods))

expectType<void>(createWevuScopedSlotComponent({ [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true }))
expectNotAssignable<Parameters<typeof createWevuScopedSlotComponent>[0]>({ [WEVU_NATIVE_SLOT_CONTEXT_KEY]: 'true' })
