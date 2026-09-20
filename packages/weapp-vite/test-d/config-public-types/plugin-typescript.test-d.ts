import type { WeappViteConfig } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const configured = defineConfig({
  weapp: {
    pluginRoot: 'plugin',
    typescript: {
      app: {
        include: ['../shared/**/*'],
        exclude: ['../plugin/private/**'],
      },
    },
  },
})
expectAssignable<WeappViteConfig>(configured.weapp)

expectNotAssignable<WeappViteConfig>({ typescript: { app: { include: [42] } } })
