import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'

export default defineConfig({
  plugins: [weapp()],
  weapp: { srcRoot: 'src' },
  build: { minify: false },
})
