import path from 'node:path'
import { defineConfig } from 'vite'
import { nshPlatformRuntime } from './src/plugin.ts'

const root = import.meta.dirname

export default defineConfig({
  root,
  publicDir: false,
  plugins: [nshPlatformRuntime({
    wasm: 'src/wasm/demo.wasm',
    appName: 'NSH Runtime Demo',
  })],
  build: {
    outDir: path.resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(root, 'src/main.ts'),
      output: { entryFileNames: 'demo.js' },
    },
  },
})
