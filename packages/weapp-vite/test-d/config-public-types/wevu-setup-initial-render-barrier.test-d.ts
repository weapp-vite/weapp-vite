import { expectAssignable, expectError } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

expectAssignable<boolean>(
  defineConfig({ weapp: { wevu: { setupInitialRenderBarrier: false } } }).weapp.wevu.setupInitialRenderBarrier,
)
defineConfig({ weapp: { wevu: { setupInitialRenderBarrier: true } } })
expectError(defineConfig({ weapp: { wevu: { setupInitialRenderBarrier: 'off' } } }))
