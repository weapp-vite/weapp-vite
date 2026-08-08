import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const projectTestExcludes = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-*/**',
  '**/.weapp-vite/**',
  '**/coverage/**',
]

const webTestFiles = [
  'src/backends/registry.test.ts',
  'src/backends/web.test.ts',
  'src/backends/miniprogram.test.ts',
  'src/cli/commands/analyze.test.ts',
  'src/cli/commands/build.test.ts',
  'src/cli/commands/open.test.ts',
  'src/cli/commands/serve.test.ts',
  'src/runtime/config/internal/merge/web.test.ts',
  'src/runtime/config/internal/merge/index.test.ts',
  'src/runtime/webPlugin.test.ts',
  'src/runtimeTarget.test.ts',
  'test/web.test.ts',
]

const webSourceFiles = [
  'src/backends/index.ts',
  'src/backends/miniprogram.ts',
  'src/backends/registry.ts',
  'src/backends/web.ts',
  'src/cli/commands/analyze.ts',
  'src/cli/commands/build.ts',
  'src/cli/commands/open.ts',
  'src/cli/commands/serve/index.ts',
  'src/runtime/config/internal/merge/index.ts',
  'src/runtime/config/internal/merge/web.ts',
  'src/runtime/webPlugin.ts',
  'src/runtimeTarget.ts',
]

const packageDir = import.meta.dirname

export default defineProject({
  name: 'weapp-vite-web',
  define: {
    'process.env.__TEST__': JSON.stringify(true),
  },
  test: {
    dir: packageDir,
    include: webTestFiles,
    exclude: projectTestExcludes,
    globals: true,
    globalSetup: ['../../vitest.globalSetup.mjs'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 120_000,
    alias: [
      {
        find: '@/',
        replacement: `${path.resolve(packageDir, './src')}/`,
      },
      {
        find: /^weapp-vite$/,
        replacement: path.resolve(packageDir, './src/index.ts'),
      },
      {
        find: /^weapp-vite\/config$/,
        replacement: path.resolve(packageDir, './src/config.ts'),
      },
      {
        find: /^wevu$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu/src/index.ts'),
      },
      {
        find: /^wevu\/compiler$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu-compiler/src/index.ts'),
      },
      {
        find: /^wevu\/api$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu/src/api.ts'),
      },
      {
        find: /^@wevu\/compiler$/,
        replacement: path.resolve(packageDir, '../wevu-compiler/src/index.ts'),
      },
      {
        find: /^@weapp-core\/shared$/,
        replacement: path.resolve(packageDir, '../..', '@weapp-core/shared/src/index.ts'),
      },
      {
        find: /^@weapp-core\/shared\/node$/,
        replacement: path.resolve(packageDir, '../..', '@weapp-core/shared/src/node.ts'),
      },
      {
        find: /^@weapp-core\/shared\/fs$/,
        replacement: path.resolve(packageDir, '../..', '@weapp-core/shared/src/fs/index.ts'),
      },
    ],
    coverage: createProjectCoverage('packages/weapp-vite/web', {
      all: true,
      include: webSourceFiles,
      exclude: [
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    }),
  },
})
