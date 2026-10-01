import type { WechatIdeLoginQueryResult } from 'weapp-ide-cli'
import { expectError, expectType } from 'tsd'
import { queryWechatIdeLogin } from 'weapp-ide-cli'

expectType<Promise<WechatIdeLoginQueryResult>>(queryWechatIdeLogin('selected-cli'))
expectType<Promise<WechatIdeLoginQueryResult>>(queryWechatIdeLogin('selected-cli', { timeout: 500 }))
declare const result: WechatIdeLoginQueryResult
if (result.status === 'success') {
  expectType<boolean>(result.login)
}
else {
  expectType<'timeout' | 'command-failed' | 'invalid-response'>(result.reason)
  expectError(result.login)
}
expectError(queryWechatIdeLogin('selected-cli', { timeout: '500' }))

queryWechatIdeLogin('cli', { timeout: 100, signal: new AbortController().signal })
