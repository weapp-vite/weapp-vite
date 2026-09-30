import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: { minify: false },
  weapp: { srcRoot: 'src', hmr: { runtime: 'stateful-experimental' } },
})
