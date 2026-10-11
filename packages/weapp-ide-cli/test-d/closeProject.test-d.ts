import type { CloseWechatIdeProjectOptions, ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import { expectAssignable, expectError, expectType } from 'tsd'
import { closeWechatIdeProject, dispatchWechatCliCommand } from 'weapp-ide-cli'

declare const target: ResolvedWechatDevtoolsTarget

expectAssignable<CloseWechatIdeProjectOptions>({})
expectAssignable<CloseWechatIdeProjectOptions>({ projectPath: 'fixture' })
expectAssignable<CloseWechatIdeProjectOptions>({ projectPath: 'fixture', target })
expectAssignable<CloseWechatIdeProjectOptions>({ projectPath: 'fixture', cliPath: 'selected-cli' })
expectAssignable<CloseWechatIdeProjectOptions>({ projectPath: 'fixture', target, cliPath: target.cliPath })
expectType<Promise<void>>(closeWechatIdeProject())
expectType<Promise<void>>(closeWechatIdeProject({ projectPath: 'fixture', target }))
expectType<Promise<void>>(closeWechatIdeProject({ projectPath: 'fixture', cliPath: target.cliPath }))
expectType<Promise<boolean>>(dispatchWechatCliCommand(['close', '--project', 'fixture', '--cli-path', target.cliPath]))
expectError(closeWechatIdeProject({ projectPath: 42 }))
expectError(closeWechatIdeProject({ projectPath: 'fixture', cliPath: 42 }))
expectError(closeWechatIdeProject({ projectPath: 'fixture', target: 'selected-cli' }))
