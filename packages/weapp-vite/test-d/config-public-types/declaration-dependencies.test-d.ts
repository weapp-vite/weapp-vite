import type { Options as RolldownDtsOptions, TscOptions } from 'rolldown-plugin-dts'
import type { WeappViteConfig } from 'weapp-vite/config'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

type PublicDtsOptions = Exclude<NonNullable<NonNullable<WeappViteConfig['lib']>['dts']>, boolean>
declare const options: PublicDtsOptions
expectType<RolldownDtsOptions | undefined>(options.rolldown)
expectType<TscOptions | undefined>(options.rolldown?.tsc)

expectAssignable<PublicDtsOptions>({
  rolldown: {
    build: false,
    incremental: true,
    parallel: false,
    eager: true,
    newContext: true,
    vue: false,
    tsc: {
      build: true,
      incremental: false,
      parallel: true,
      eager: false,
      newContext: true,
      vue: false,
    },
    compilerOptions: { allowJs: false, preserveSymlinks: true },
  },
})

expectNotAssignable<PublicDtsOptions>({ rolldown: { tsc: { build: 'enabled' } } })
expectNotAssignable<PublicDtsOptions>({ rolldown: { tsc: { compilerOptions: { allowJs: true } } } })
