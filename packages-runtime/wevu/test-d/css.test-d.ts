import { expectError, expectType } from 'tsd'
import { useCssModule } from 'wevu'

expectType<Record<string, string>>(useCssModule())
expectType<Record<string, string>>(useCssModule('theme'))
expectError(useCssModule(1))
