import type { ResolvedWechatDevtoolsTarget, WechatDevtoolsHttpCommandOptions, WechatDevtoolsInstallation, WechatDevtoolsSelectionOptions } from 'weapp-ide-cli'
import { expectAssignable, expectError, expectType } from 'tsd'
import { assertWechatDevtoolsHost, assertWechatDevtoolsPort, bootstrapWechatDevtoolsSettings, detectWechatDevtoolsServicePort, getActiveWechatDevtoolsTarget, getRuntimeWechatDevtoolsServicePort, listWechatDevtoolsInstallations, prepareAcceptanceProject, registerWechatDevtoolsInstallation, resolveWechatDevtoolsTarget, runWechatIdeEngineBuild, setRuntimeWechatDevtoolsServicePort, unregisterWechatDevtoolsInstallation } from 'weapp-ide-cli'

expectType<Promise<ResolvedWechatDevtoolsTarget>>(resolveWechatDevtoolsTarget({ cliPath: 'selected-cli' }))
const target: ResolvedWechatDevtoolsTarget = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'application', profileDir: 'profile' }
expectType<Promise<ResolvedWechatDevtoolsTarget>>(resolveWechatDevtoolsTarget({ target, cliPath: 'selected-cli' }))
expectError(resolveWechatDevtoolsTarget({ target: 'selected-cli' }))
expectAssignable<WechatDevtoolsHttpCommandOptions>({ target, cliPath: target.cliPath })
expectType<Promise<void>>(assertWechatDevtoolsHost(target))
expectType<Promise<void>>(assertWechatDevtoolsPort(target, 22001))
expectType<number | undefined>(getRuntimeWechatDevtoolsServicePort(target))
setRuntimeWechatDevtoolsServicePort(22001, target)
detectWechatDevtoolsServicePort({ target })
bootstrapWechatDevtoolsSettings({ target, trustProject: false })
runWechatIdeEngineBuild('fixture', { target })
prepareAcceptanceProject('fixture', new AbortController().signal, { target, runtimeProvider: 'devtools' })
expectError(resolveWechatDevtoolsTarget({ cliPath: 123 }))
expectError(assertWechatDevtoolsPort(target, '22001'))

expectType<Promise<ResolvedWechatDevtoolsTarget>>(resolveWechatDevtoolsTarget({ devtoolsChannel: 'nightly', devtoolsVersion: '2.02.2608080', requireOfficialLatest: false }))
expectError(resolveWechatDevtoolsTarget({ devtoolsChannel: 'beta' }))
expectError(resolveWechatDevtoolsTarget({ devtoolsVersion: 123 }))

expectType<Promise<WechatDevtoolsInstallation[]>>(listWechatDevtoolsInstallations())
expectType<Promise<ResolvedWechatDevtoolsTarget>>(registerWechatDevtoolsInstallation('fixture-cli'))
expectType<Promise<void>>(unregisterWechatDevtoolsInstallation('fixture-cli'))
expectType<ResolvedWechatDevtoolsTarget | undefined>(getActiveWechatDevtoolsTarget())
expectAssignable<WechatDevtoolsSelectionOptions>({ devtoolsChannel: 'rc', devtoolsVersion: '2.02.2608080' })
