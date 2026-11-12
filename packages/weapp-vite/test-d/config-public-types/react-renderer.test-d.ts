import { expectError, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

expectType<'auto'>(
  defineConfig({ weapp: { react: { renderer: 'auto' } } }).weapp.react.renderer,
)
defineConfig({ weapp: { react: { renderer: 'legacy' } } })
defineConfig({ weapp: { react: { renderer: 'native-dom' } } })
expectError(defineConfig({ weapp: { react: { renderer: 'tt-dom' } } }))
