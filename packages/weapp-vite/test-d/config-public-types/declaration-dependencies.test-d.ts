import type { Options as RolldownDtsOptions } from 'rolldown-plugin-dts'
import type { WeappViteConfig } from 'weapp-vite/config'
import { expectType } from 'tsd'

type PublicDtsOptions = Exclude<NonNullable<NonNullable<WeappViteConfig['lib']>['dts']>, boolean>
declare const options: PublicDtsOptions
expectType<RolldownDtsOptions | undefined>(options.rolldown)
