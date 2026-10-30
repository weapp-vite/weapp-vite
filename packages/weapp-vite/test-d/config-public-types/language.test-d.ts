import type { WeappViteConfig } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

expectAssignable<WeappViteConfig>({ language: { overrides: [{ files: ['src/alipay/**/*.sjs'], platform: 'alipay' }] } })
expectAssignable<WeappViteConfig>({ language: { platform: 'ks' } })
expectNotAssignable<WeappViteConfig>({ platform: 'ks' })
expectNotAssignable<WeappViteConfig>({ language: { platform: 'unknown' } })
expectNotAssignable<WeappViteConfig>({ language: { overrides: [{ files: [42], platform: 'weapp' }] } })
defineConfig({ weapp: { platform: 'weapp', language: { overrides: [{ files: ['src/**/*.sjs'], platform: 'tt' }] } } })
