import { defineConfig } from 'weapp-vite'
import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: { srcRoot: 'src', autoRoutes: false, autoImportComponents: { resolvers: [VantResolver()] } },
  build: { minify: false },
})
