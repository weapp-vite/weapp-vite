import type { AutomatorOptions, AutomatorSessionOptions, ResolvedWechatDevtoolsTarget, StartWeappIdeMcpServerOptions } from 'weapp-ide-cli'
import { expectAssignable, expectError, expectType } from 'tsd'
import { closeSharedMiniProgram, releaseSharedMiniProgram, resolveAutomatorSessionOptions } from 'weapp-ide-cli'

declare const target: ResolvedWechatDevtoolsTarget
expectAssignable<AutomatorOptions>({ projectPath: 'fixture', cliPath: 'cli', target })
expectAssignable<AutomatorSessionOptions>({ projectPath: 'fixture', cliPath: 'cli', target, installationId: target.installationId })
expectAssignable<AutomatorSessionOptions>({ projectPath: 'fixture', runtimeProvider: 'headless' })
expectAssignable<StartWeappIdeMcpServerOptions>({ cliPath: 'cli' })
expectType<Promise<void>>(closeSharedMiniProgram('fixture', 'worker', { installationId: target.installationId }))
expectType<void>(releaseSharedMiniProgram('fixture', 'worker', { installationId: target.installationId }))
resolveAutomatorSessionOptions({ projectPath: 'fixture', sharedSession: true }).then((resolved) => {
  expectType<string>(resolved.installationId)
  expectType<ResolvedWechatDevtoolsTarget | undefined>(resolved.target)
})
expectError(closeSharedMiniProgram('fixture', undefined, { installationId: 42 }))
expectError(resolveAutomatorSessionOptions({ projectPath: 'fixture', target: 'cli' }))
