import { expectError, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

expectType<'auto'>(
  defineConfig({ weapp: { wevu: { renderer: 'auto' } } }).weapp.wevu.renderer,
)
defineConfig({ weapp: { wevu: { renderer: 'legacy' } } })
defineConfig({ weapp: { wevu: { renderer: 'native-dom' } } })
expectError(defineConfig({ weapp: { wevu: { renderer: 'tt-dom' } } }))
