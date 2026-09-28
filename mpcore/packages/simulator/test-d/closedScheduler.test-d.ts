import { RuntimeKernel } from '@mpcore/simulator'
import { expectType } from 'tsd'

const kernel = new RuntimeKernel()
const timeout = kernel.scheduler.setTimeout(() => {}, 0)
const interval = kernel.scheduler.setInterval(() => {}, 0)
expectType<void>(kernel.scheduler.clearTimeout(timeout))
expectType<void>(kernel.scheduler.clearInterval(interval))
expectType<void>(kernel.close())
expectType<typeof timeout>(kernel.scheduler.setTimeout(() => {}, 0))
expectType<void>(kernel.scheduler.queueMicrotask(() => {}))
