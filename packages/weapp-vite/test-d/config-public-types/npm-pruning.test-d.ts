import type { WeappViteConfig } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

expectAssignable<WeappViteConfig>({ npm: { pruneUnusedFiles: true } })
expectAssignable<WeappViteConfig>({ npm: { pruneUnusedFiles: false } })
defineConfig({ weapp: { npm: { pruneUnusedFiles: true, packageFiles: { 'tdesign-miniprogram': { include: ['button/**'] } } } } })
expectNotAssignable<WeappViteConfig>({ npm: { pruneUnusedFiles: 'enabled' } })
