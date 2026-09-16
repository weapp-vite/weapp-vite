import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'weapp-vite'
import wevu from 'weapp-vite/auto-import-presets/wevu'
import wevuRouter from 'weapp-vite/auto-import-presets/wevu-router'

export default defineConfig({
  plugins: [AutoImport({ dts: 'src/auto-imports.d.ts', imports: [wevu, wevuRouter] })],
  weapp: { srcRoot: 'src' },
})
