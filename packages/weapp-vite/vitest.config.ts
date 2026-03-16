import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  define: {
    'process.env.__TEST__': JSON.stringify(true),
  },
  test: {
    alias: [
      {
        find: '@/',
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
      {
        find: '@weapp-vite/ast/babelCore',
        replacement: path.resolve(__dirname, '../ast/dist/babelCore.mjs'),
      },
      {
        find: '@weapp-vite/ast/babel',
        replacement: path.resolve(__dirname, '../ast/dist/babel.mjs'),
      },
      {
        find: '@weapp-vite/ast/babelTraverse',
        replacement: path.resolve(__dirname, '../ast/dist/babelTraverse.mjs'),
      },
      {
        find: '@weapp-vite/ast/babelTypes',
        replacement: path.resolve(__dirname, '../ast/dist/babelTypes.mjs'),
      },
      {
        find: '@weapp-vite/ast/operations/onPageScroll',
        replacement: path.resolve(__dirname, '../ast/dist/operations/onPageScroll.mjs'),
      },
      {
        find: '@weapp-vite/ast/operations/setDataPick',
        replacement: path.resolve(__dirname, '../ast/dist/operations/setDataPick.mjs'),
      },
      {
        find: '@weapp-vite/ast',
        replacement: path.resolve(__dirname, '../ast/dist/index.mjs'),
      },
      {
        find: '@wevu/compiler',
        replacement: path.resolve(__dirname, '../wevu-compiler/src/index.ts'),
      },
      {
        find: 'weapp-vite/auto-routes',
        replacement: path.resolve(__dirname, './src/auto-routes.ts'),
      },
    ],
    globals: true,
    hookTimeout: 60_000,
    testTimeout: 120_000,
    // @ts-ignore
    coverage: {
      enabled: true,
      all: false,
      exclude: [
        '**/dist/**',
      ],
    },
  },
})
