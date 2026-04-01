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
    alias: [
      {
        find: /^@weapp-vite\/ast\/babelTraverse$/,
        replacement: resolve(__dirname, 'src/browserAst/babelTraverse.ts'),
      },
      {
        find: /^@weapp-vite\/ast\/babelTypes$/,
        replacement: resolve(__dirname, 'src/browserAst/babelTypes.ts'),
      },
      {
        find: /^@weapp-vite\/ast\/babel$/,
        replacement: resolve(__dirname, 'src/browserAst/babel.ts'),
      },
      {
        find: /^@weapp-vite\/ast$/,
        replacement: resolve(__dirname, 'src/browserAst/index.ts'),
      },
      {
        find: /^node:path$/,
        replacement: 'pathe',
      },
      {
        find: /^path$/,
        replacement: 'pathe',
      },
      {
        find: /^@$/,
        replacement: resolve(__dirname, 'src'),
      },
      {
        find: '@',
        replacement: resolve(__dirname, 'src'),
      },
    ],
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
})
