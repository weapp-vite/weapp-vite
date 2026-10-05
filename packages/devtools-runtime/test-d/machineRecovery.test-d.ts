import type {
  MachineE2ELeaseRecoveryOptions,
  MachineE2ELeaseRecoveryResult,
  MachineE2ELeaseRecoveryScope,
  MachineE2ELeaseSnapshot,
} from '@weapp-vite/devtools-runtime'
import { readMachineE2ELeaseSnapshot, recoverMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { expectAssignable, expectError, expectType } from 'tsd'

expectType<Promise<MachineE2ELeaseSnapshot>>(readMachineE2ELeaseSnapshot())
expectType<Promise<MachineE2ELeaseSnapshot>>(readMachineE2ELeaseSnapshot({ stateDirectory: 'state', env: {} }))
expectError(readMachineE2ELeaseSnapshot({ stateDirectory: 42 }))

declare const snapshot: MachineE2ELeaseSnapshot
expectType<number>(snapshot.owner.pid)
expectType<string>(snapshot.owner.token)
expectType<string>(snapshot.scopes[0]!.id)
expectType<number>(snapshot.scopes[0]!.owner.pid)
expectType<string>(snapshot.scopes[0]!.owner.token)
expectType<boolean>(snapshot.scopes[0]!.sealed)
expectType<boolean>(snapshot.scopes[0]!.completed)
expectAssignable<readonly string[]>(snapshot.scopes[0]!.ancestors)
expectType<number>(snapshot.borrowers[0]!.pid)
expectType<string>(snapshot.borrowers[0]!.token)
expectAssignable<readonly string[]>(snapshot.borrowers[0]!.scopes)
expectError(snapshot.owner.pid = 42)
expectError(snapshot.scopes.push(snapshot.scopes[0]!))
expectError(snapshot.borrowers[0]!.scopes.push('another-scope'))

expectAssignable<MachineE2ELeaseRecoveryOptions>({
  stateDirectory: 'state',
  env: {},
  expected: snapshot,
  recoverScope: async () => {},
})

expectType<Promise<MachineE2ELeaseRecoveryResult>>(recoverMachineE2ELease({
  expected: snapshot,
  recoverScope: async (scope) => {
    expectType<MachineE2ELeaseRecoveryScope>(scope)
    expectType<string>(scope.id)
    expectType<number>(scope.owner.pid)
    expectType<string>(scope.owner.token)
    expectAssignable<readonly string[]>(scope.ancestors)
    expectType<boolean>(scope.sealed)
    expectType<boolean>(scope.completed)
    expectError(scope.id = 'another-scope')
    expectError(scope.owner = snapshot.owner)
    expectError(scope.owner.pid = 42)
    expectError(scope.owner.token = 'another-owner')
    expectError(scope.ancestors = [])
    expectError(scope.ancestors.push('another-scope'))
    expectError(scope.ancestors[0] = 'another-scope')
    expectError(scope.sealed = false)
    expectError(scope.completed = true)
  },
}))

expectError(recoverMachineE2ELease())
expectError(recoverMachineE2ELease({ recoverScope: async () => {} }))
expectError(recoverMachineE2ELease({ expected: snapshot }))
expectError(recoverMachineE2ELease({ expected: snapshot, recoverScope: () => {} }))
expectError(recoverMachineE2ELease({ expected: snapshot, recoverScope: async () => 'released' }))
expectError(recoverMachineE2ELease({ expected: {}, recoverScope: async () => {} }))

declare const result: MachineE2ELeaseRecoveryResult
expectType<string>(result.auditFile)
expectType<string[]>(result.recoveredScopes)
