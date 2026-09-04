import type { RuntimeApp, RuntimeInstance, SetDataBindingDiagnostic, SetDataDebugInfo } from '@/index'
import { expectType } from 'tsd'
import { createApp, version } from '@/index'

const app = createApp({
  data: () => ({ count: 0 }),
  computed: {
    double() {
      return 2
    },
  },
  methods: {
    inc() {
    },
  },
})

expectType<RuntimeApp<{ count: number }, { double: () => number }, { inc: () => void }>>(app)
expectType<string>(app.version)
expectType<RuntimeApp<{ count: number }, { double: () => number }, { inc: () => void }>>(app.provide('token', 1))
expectType<RuntimeApp<{ count: number }, { double: () => number }, { inc: () => void }>>(app.onUnmount(() => {}))
expectType<void>(app.unmount())
expectType<string>(version)

const instance = app.mount()
expectType<RuntimeInstance<{ count: number }, { double: () => number }, { inc: () => void }>>(instance)
expectType<number>(instance.state.count)
expectType<number>(instance.computed.double)
expectType<void>(instance.methods.inc())
expectType<Record<string, any>>(instance.snapshot())

declare const debugInfo: SetDataDebugInfo
expectType<SetDataBindingDiagnostic[] | undefined>(debugInfo.bindings)
expectType<string | undefined>(debugInfo.bindings?.[0]?.id)
expectType<string | undefined>(debugInfo.bindings?.[0]?.outputPath)
expectType<'exact-path' | 'top-level' | 'snapshot-fallback' | undefined>(debugInfo.bindings?.[0]?.updateMode)
expectType<string | undefined>(debugInfo.bindings?.[0]?.sourceFile)
expectType<number | undefined>(debugInfo.bindings?.[0]?.sourceLocation?.start.line)

declare const bindingDiagnostic: SetDataBindingDiagnostic
expectType<string>(bindingDiagnostic.id)
expectType<string>(bindingDiagnostic.outputPath)
expectType<'exact-path' | 'top-level' | 'snapshot-fallback'>(bindingDiagnostic.updateMode)
expectType<string>(bindingDiagnostic.sourceFile)
expectType<number | undefined>(bindingDiagnostic.sourceLocation?.start.column)
