import type { InstallRequestGlobalsOptions, WeappInjectRequestGlobalsTarget } from '@wevu/web-apis'
import { installRequestGlobals } from '@wevu/web-apis'
import { expectError, expectType } from 'tsd'

const target: WeappInjectRequestGlobalsTarget = 'fetch'
expectType<WeappInjectRequestGlobalsTarget>(target)

const options: InstallRequestGlobalsOptions = {
  targets: ['fetch', 'Request', 'XMLHttpRequest'],
}
expectType<WeappInjectRequestGlobalsTarget[] | undefined>(options.targets)
expectType<void>(installRequestGlobals(options))
expectType<void>(installRequestGlobals())

expectError<WeappInjectRequestGlobalsTarget>('URL')
expectError<InstallRequestGlobalsOptions>({
  targets: ['URL'],
})
