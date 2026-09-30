import type { AcceptanceOptions, AcceptanceService } from '@weapp-vite/acceptance'
import type { DevtoolsRuntimeHooks, RuntimeLease } from '@weapp-vite/devtools-runtime'
import { acquireRuntimeLease, runWithRuntimeLease } from '@weapp-vite/devtools-runtime'
import { createRuntimeAcceptanceService } from '@weapp-vite/mcp'
import { expectType } from 'tsd'

declare const hooks: DevtoolsRuntimeHooks
declare const options: AcceptanceOptions
declare const lease: RuntimeLease
expectType<Promise<AcceptanceService>>(createRuntimeAcceptanceService('.', options, hooks))
expectType<Promise<RuntimeLease>>(acquireRuntimeLease('.'))
expectType<Promise<number>>(runWithRuntimeLease(lease, async () => 1))
expectType<Promise<void>>(lease.release())
