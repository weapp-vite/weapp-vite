import type { RuntimeCapabilityName, RuntimeCapabilityRegistry } from 'wevu/internal-runtime'
import { expectAssignable, expectType } from 'tsd'
import { installJsxIslands as installDevJsxIslands } from 'wevu/dev/internal-runtime'
import { installJsxIslands } from 'wevu/internal-runtime'

expectType<void>(installJsxIslands())
expectType<typeof installJsxIslands>(installDevJsxIslands)
expectAssignable<RuntimeCapabilityName>('jsxIslands')

declare const registry: RuntimeCapabilityRegistry
declare const methods: Record<string, (...args: any[]) => any>
expectType<void | undefined>(registry.jsxIslands?.attachMethods(methods))
