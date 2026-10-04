import type { ConfigSource, ResolvedConfig } from 'weapp-ide-cli'
import { expectAssignable, expectType } from 'tsd'
import { getConfig } from 'weapp-ide-cli'

expectAssignable<ConfigSource>('environment')
expectType<Promise<ResolvedConfig>>(getConfig())
