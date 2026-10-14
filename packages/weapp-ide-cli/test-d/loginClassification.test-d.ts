import { expectError, expectType } from 'tsd'
import { createWechatIdeLoginRequiredExitError, isAutomatorLoginError, isWechatIdeLoginRequiredError, isWechatIdeLoginRequiredExitError } from 'weapp-ide-cli'

declare const failure: unknown
expectType<boolean>(isWechatIdeLoginRequiredError(failure))
expectType<boolean>(isWechatIdeLoginRequiredExitError(failure))
expectType<boolean>(isAutomatorLoginError(failure))
const loginError = createWechatIdeLoginRequiredExitError(failure, '非交互模式')
expectType<number>(loginError.code)
expectType<number>(loginError.exitCode)
expectError(createWechatIdeLoginRequiredExitError(failure, 10))
