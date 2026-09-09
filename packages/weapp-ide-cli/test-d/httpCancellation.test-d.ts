import type { RunWechatIdeEngineBuildByHttpOptions, RunWechatIdeEngineBuildOptions, WechatDevtoolsHttpCommandOptions } from 'weapp-ide-cli'
import { expectAssignable, expectError, expectType } from 'tsd'
import { openWechatIdeProjectByHttp, pollWechatIdeEngineBuildResultByHttp, requestWechatDevtoolsHttp, resetWechatIdeFileUtilsByHttp, runWechatIdeEngineBuild, runWechatIdeEngineBuildByHttp, startWechatIdeEngineBuildByHttp } from 'weapp-ide-cli'

const signal = new AbortController().signal
const options = { signal }
expectAssignable<WechatDevtoolsHttpCommandOptions>(options)
expectAssignable<RunWechatIdeEngineBuildByHttpOptions>(options)
expectAssignable<RunWechatIdeEngineBuildOptions>(options)
expectType<AbortSignal | undefined>(({} as WechatDevtoolsHttpCommandOptions).signal)
expectType<Promise<string>>(requestWechatDevtoolsHttp('/open', {}, options))
expectType<Promise<string>>(openWechatIdeProjectByHttp('fixture', options))
expectType<Promise<string>>(resetWechatIdeFileUtilsByHttp('fixture', options))
startWechatIdeEngineBuildByHttp('fixture', options)
pollWechatIdeEngineBuildResultByHttp(options)
runWechatIdeEngineBuildByHttp('fixture', options)
runWechatIdeEngineBuild('fixture', options)
expectError(openWechatIdeProjectByHttp('fixture', { signal: new AbortController() }))
expectError(runWechatIdeEngineBuild('fixture', { signal: 'cancel' }))
