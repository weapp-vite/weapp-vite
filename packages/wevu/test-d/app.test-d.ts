import type { RuntimeApp, RuntimeInstance } from '@/index'
import { expectType } from 'tsd'
import { createApp } from '@/index'

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

const instance = app.mount()
expectType<RuntimeInstance<{ count: number }, { double: () => number }, { inc: () => void }>>(instance)
expectType<number>(instance.state.count)
expectType<number>(instance.computed.double)
expectType<void>(instance.methods.inc())
expectType<Record<string, any>>(instance.snapshot())
