import { weappSqlite } from '@weapp-sqlite/weapp-vite'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: { srcRoot: 'src', npm: { enable: false }, hmr: { runtime: 'classic' } },
  plugins: [weappSqlite({
    wasm: { variant: 'lite', weappPackage: { mode: 'existing-subpackage', root: 'shared' } },
  })],
})
