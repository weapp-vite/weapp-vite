import type { ResolvedWechatDevtoolsTarget, StartWechatIdeAgentOptions, StartWechatIdeAgentResult } from 'weapp-ide-cli'
import { expectAssignable, expectError, expectType } from 'tsd'
import { startWechatIdeAgent } from 'weapp-ide-cli'

declare const target: ResolvedWechatDevtoolsTarget
const options = { projectPath: 'fixture', port: 19201 }
expectAssignable<StartWechatIdeAgentOptions>(options)
expectAssignable<StartWechatIdeAgentOptions>({ ...options, cliPath: 'selected-cli', target, trustProject: false, timeout: 1000, signal: new AbortController().signal })
expectType<Promise<StartWechatIdeAgentResult>>(startWechatIdeAgent(options))
expectType<Promise<StartWechatIdeAgentResult>>(startWechatIdeAgent({ ...options, onStarted: async (result) => {
  expectType<StartWechatIdeAgentResult>(result)
} }))
startWechatIdeAgent({ ...options, target }).then((result) => {
  expectType<number>(result.autoPort)
  expectType<boolean>(result.openedProjectWindow)
  expectType<string>(result.version)
})
expectError(startWechatIdeAgent({ port: 19201 }))
expectError(startWechatIdeAgent({ projectPath: 'fixture' }))
expectError(startWechatIdeAgent({ ...options, port: '19201' }))
expectError(startWechatIdeAgent({ ...options, cliPath: 42 }))
expectError(startWechatIdeAgent({ ...options, target: 'selected-cli' }))
expectError(startWechatIdeAgent({ ...options, trustProject: 'true' }))
expectError(startWechatIdeAgent({ ...options, timeout: '1000' }))
expectError(startWechatIdeAgent({ ...options, signal: true }))
expectError(startWechatIdeAgent({ ...options, onStarted: true }))
