import type { WeappViteConfig } from 'weapp-vite'
import type { UserConfig } from 'weapp-vite/config'
import { expectAssignable, expectError, expectNotAssignable } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

expectAssignable<WeappViteConfig>({ vue: { template: { nativeSlotContext: true, scopedSlotsRequireProps: true } } })
expectAssignable<WeappViteConfig>({ vue: { template: { nativeSlotContext: false } } })
expectAssignable<UserConfig>(defineConfig({ weapp: { vue: { template: { nativeSlotContext: true } } } }))
expectNotAssignable<WeappViteConfig>({ vue: { template: { nativeSlotContext: 'true' } } })
expectError(defineConfig({ weapp: { vue: { template: { nativeSlotContext: 'true' } } } }))
