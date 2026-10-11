import type { AutomatorOptions, AutomatorSessionOptions, ResolvedWechatDevtoolsTarget, StartWeappIdeMcpServerOptions } from 'weapp-ide-cli'
import { expectAssignable, expectError, expectType } from 'tsd'
import { closeSharedMiniProgram, persistOpenedAutomatorSession, releaseSharedMiniProgram, resolveAutomatorSessionOptions } from 'weapp-ide-cli'

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

const openedSession = {
  projectPath: 'fixture',
  cliPath: target.cliPath,
  target,
  installationId: target.installationId,
  port: 19620,
  sessionId: 'external-bridge',
  signal: new AbortController().signal,
  timeout: 30_000,
  wsEndpoint: 'ws://127.0.0.1:19620',
}
expectType<Promise<void>>(persistOpenedAutomatorSession(openedSession))
expectType<Promise<void>>(persistOpenedAutomatorSession({
  projectPath: 'fixture',
  cliPath: target.cliPath,
  wsEndpoint: openedSession.wsEndpoint,
}))
expectError(persistOpenedAutomatorSession({ projectPath: 'fixture', target }))
expectError(persistOpenedAutomatorSession({ wsEndpoint: openedSession.wsEndpoint, target }))
expectError(persistOpenedAutomatorSession({ ...openedSession, wsEndpoint: 19620 }))
expectError(persistOpenedAutomatorSession({ ...openedSession, port: '19620' }))
expectError(persistOpenedAutomatorSession({ ...openedSession, installationId: 42 }))
expectError(persistOpenedAutomatorSession({ ...openedSession, target: 'cli' }))
