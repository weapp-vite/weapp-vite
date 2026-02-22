import type { ModelBindingPayload, WatchStopHandle } from '@/index'
import { expectError, expectType } from 'tsd'
import { createApp } from '@/index'

const app = createApp({
  data: () => ({
    count: 0,
    label: 'wevu',
  }),
  computed: {
    double() {
      return 2
    },
  },
  methods: {
    inc(step: number = 1): number {
      return step
    },
    rename(next: string) {
      void next
    },
  },
})

const instance = app.mount()

expectType<number>(instance.state.count)
expectType<string>(instance.state.label)
expectType<number>(instance.computed.double)
expectType<number>(instance.methods.inc())
expectType<number>(instance.methods.inc(2))
expectType<void>(instance.methods.rename('next'))
expectType<number>(instance.proxy.count)
expectType<number>(instance.proxy.double)
expectType<number>(instance.proxy.inc(1))
expectType<Record<string, any>>(instance.snapshot())
expectType<void>(instance.unmount())

const watchStop = instance.watch(
  () => instance.state.count,
  (value, oldValue) => {
    expectType<number>(value)
    expectType<number>(oldValue)
  },
)
expectType<WatchStopHandle>(watchStop)
expectType<void>(watchStop())
expectType<void>(watchStop.stop())
expectType<void>(watchStop.pause())
expectType<void>(watchStop.resume())

const model = instance.bindModel<number>('count')
expectType<number>(model.value)
expectType<void>(model.update(1))
expectType<ModelBindingPayload<number>>(model.model())

const customizedModelPayload = model.model({
  event: 'change',
  valueProp: 'detail',
})
expectType<ModelBindingPayload<number, 'change', 'detail'>>(customizedModelPayload)
expectType<number>(customizedModelPayload.detail)
expectType<(event: any) => void>(customizedModelPayload.onChange)

expectError(instance.__wevu_touchSetupMethodsVersion)
expectError(instance.notExists)
