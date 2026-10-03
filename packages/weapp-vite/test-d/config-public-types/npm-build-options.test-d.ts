import type { WeappViteConfig } from 'weapp-vite'
import { expectAssignable, expectNotAssignable } from 'tsd'

expectAssignable<WeappViteConfig>({ npm: { buildOptions: () => false } })
expectAssignable<WeappViteConfig>({ npm: { buildOptions: options => options } })
expectAssignable<WeappViteConfig>({ npm: { buildOptions: () => undefined } })
expectNotAssignable<WeappViteConfig>({ npm: { buildOptions: () => true } })
