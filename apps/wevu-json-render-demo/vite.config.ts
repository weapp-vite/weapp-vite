import { JsonRendererResolver } from '@wevu/json-render/resolver'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: { resolvers: [JsonRendererResolver()] },
  },
})
