import { resolve } from 'node:path'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const playgroundRoot = import.meta.dirname

export default defineConfig({
  root: playgroundRoot,
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
        replacement: resolve(playgroundRoot, 'src/browserAst/babelTraverse.ts'),
      },
      {
        find: /^@weapp-vite\/ast\/babelTypes$/,
        replacement: resolve(playgroundRoot, 'src/browserAst/babelTypes.ts'),
      },
      {
        find: /^@weapp-vite\/ast\/babel$/,
        replacement: resolve(playgroundRoot, 'src/browserAst/babel.ts'),
      },
      {
        find: /^@weapp-vite\/ast$/,
        replacement: resolve(playgroundRoot, 'src/browserAst/index.ts'),
      },
      {
        find: /^@weapp-core\/shared$/,
        replacement: resolve(playgroundRoot, '../../@weapp-core/shared/src/index.ts'),
      },
      {
        find: /^@weapp-core\/constants$/,
        replacement: resolve(playgroundRoot, '../../@weapp-core/constants/src/index.ts'),
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
        replacement: resolve(playgroundRoot, 'src'),
      },
      {
        find: '@',
        replacement: resolve(playgroundRoot, 'src'),
      },
    ],
  },
  build: {
    outDir: resolve(playgroundRoot, 'dist'),
    emptyOutDir: true,
  },
})
