import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
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
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: {
      exclude: [
        '**/dist/**',
      ],
    },
  },
})
