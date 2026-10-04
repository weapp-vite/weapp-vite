import type { AppServiceHeapUsage, AppServiceHeapUsageOptions, MiniProgram } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'

declare const miniProgram: MiniProgram
const options: AppServiceHeapUsageOptions = { timeout: 1_000 }
expectType<Promise<AppServiceHeapUsage>>(miniProgram.getAppServiceHeapUsage())
expectType<Promise<AppServiceHeapUsage>>(miniProgram.getAppServiceHeapUsage(options))
expectError(miniProgram.getAppServiceHeapUsage({ timeout: '1000' }))
expectError(miniProgram.getAppServiceHeapUsage({ forceGC: true }))
declare const result: AppServiceHeapUsage
if (result.status === 'available') {
  expectType<number>(result.usedSize)
  expectType<number>(result.totalSize)
  expectError(result.reason)
}
else {
  expectType<'protocol-unimplemented' | 'method-not-found'>(result.reason)
  expectError(result.usedSize)
}
