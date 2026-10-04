import type { MachineE2ELease, MachineE2ELeaseOptions } from '@weapp-vite/devtools-runtime'
import { acquireMachineE2ELease, withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<MachineE2ELeaseOptions>({ stateDirectory: 'state', env: {} })
expectType<Promise<MachineE2ELease>>(acquireMachineE2ELease())
expectType<Promise<number>>(withMachineE2ELease(async () => 42))
withMachineE2ELease(async (active) => {
  expectType<MachineE2ELease>(active)
})
declare const lease: MachineE2ELease
expectType<boolean>(lease.borrowed)
expectType<boolean>(lease.released)
expectType<Promise<void>>(lease.release())
expectAssignable<NodeJS.ProcessEnv>(lease.environment)
