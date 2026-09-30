import type { WeappAutoRoutesConfig, WeappViteConfig } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

expectAssignable<WeappAutoRoutesConfig>({ extensions: ['vue', 'tsx'] })
expectAssignable<WeappViteConfig>({ autoRoutes: { extensions: [] } })
expectNotAssignable<WeappAutoRoutesConfig>({ extensions: 'vue' })
expectNotAssignable<WeappAutoRoutesConfig>({ extensions: [true] })
defineConfig({ weapp: { autoRoutes: { include: 'pages/**', extensions: ['.vue'] } } })
