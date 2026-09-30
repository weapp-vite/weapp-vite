import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'

export default defineConfig({
  plugins: [weapp()],
  define: { __WEAPP_CHUNK_SCENARIO__: JSON.stringify('worker') },
  weapp: { srcRoot: 'src', worker: { entry: ['index', 'messages/index'] }, npm: { enable: false }, hmr: { runtime: 'classic' } },
})
