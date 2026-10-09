import type {
  MachineE2EChildScope,
  MachineE2EChildScopeOptions,
  MachineE2ELease,
  MachineE2ELeaseOptions,
  MachineE2ERecoverableDescendantScope,
} from '@weapp-vite/devtools-runtime'
import { acquireMachineE2ELease, withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { expectAssignable, expectError, expectType } from 'tsd'

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
expectType<Promise<MachineE2EChildScope>>(lease.createChildScope())
expectType<Promise<MachineE2EChildScope>>(lease.createChildScope({ cleanupKey: 'owned-journal' }))
expectAssignable<MachineE2EChildScopeOptions>({})
expectAssignable<MachineE2EChildScopeOptions>({ cleanupKey: 'owned-journal' })
expectError(lease.createChildScope({ cleanupKey: 42 }))
declare const childScope: MachineE2EChildScope
expectAssignable<NodeJS.ProcessEnv>(childScope.environment)
expectType<Promise<void>>(childScope.seal())
expectType<Promise<void>>(childScope.complete())
expectType<Promise<void>>(childScope.recoverStoppedDescendants(async (scope) => {
  expectType<MachineE2ERecoverableDescendantScope>(scope)
  expectType<string>(scope.id)
  expectType<number>(scope.owner.pid)
  expectType<string>(scope.owner.token)
  expectType<readonly string[]>(scope.ancestors)
  expectType<boolean>(scope.sealed)
  expectType<boolean>(scope.completed)
  expectType<string>(scope.cleanupKey)
  expectError(scope.id = 'another-scope')
  expectError(scope.owner = { pid: 42, token: 'another-owner' })
  expectError(scope.owner.pid = 42)
  expectError(scope.owner.token = 'another-owner')
  expectError(scope.ancestors = [])
  expectError(scope.ancestors.push('another-scope'))
  expectError(scope.ancestors[0] = 'another-scope')
  expectError(scope.sealed = false)
  expectError(scope.completed = true)
  expectError(scope.cleanupKey = 'another-journal')
}))
expectError(childScope.recoverStoppedDescendants())
expectError(childScope.recoverStoppedDescendants(() => {}))
expectError(childScope.recoverStoppedDescendants(async () => 'released'))
