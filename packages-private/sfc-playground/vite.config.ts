import { resolve } from 'node:path'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: __dirname,
  base: './',
  appType: 'spa',
  define: {
    'process.env.BABEL_TYPES_8_BREAKING': 'false',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['@vue/repl'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@weapp-vite/ast/babelTraverse': resolve(__dirname, 'src/browserAst/babelTraverse.ts'),
      '@weapp-vite/ast/babelTypes': resolve(__dirname, 'src/browserAst/babelTypes.ts'),
      '@weapp-vite/ast/babel': resolve(__dirname, 'src/browserAst/babel.ts'),
      '@weapp-vite/ast': resolve(__dirname, 'src/browserAst/index.ts'),
      'node:path': 'pathe',
      'path': 'pathe',
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
})
