import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'
import { createFastTestIncludes, parallelFixtureTests, serialFixtureTestIncludes } from './vitest/partition.ts'

const projectTestIncludes = [
  ...serialFixtureTestIncludes,
  'src/**/*.test.ts',
  'src/**/*.spec.ts',
  'scripts/**/*.test.ts',
  'scripts/**/*.spec.ts',
]

const projectTestExcludes = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-*/**',
  '**/.weapp-vite/**',
  '**/coverage/**',
]

const serialTestFiles = [
  'src/plugins/autoImport.test.ts',
  'src/plugins/wxs.test.ts',
  'src/plugins/core/lifecycle/load.test.ts',
  'src/plugins/core/lifecycle/watch.test.ts',
  'src/runtime/autoRoutesPlugin.test.ts',
  'src/runtime/buildPlugin/layoutBuild.native.test.ts',
  'src/runtime/buildPlugin/layoutBuild.test.ts',
  'src/runtime/buildPlugin/pluginDemo.test.ts',
  'src/runtime/lib.test.ts',
  'src/runtime/libDts.test.ts',
  'src/runtime/config/internal/loadConfig.test.ts',
  'src/runtime/npmPlugin/builder.alipay.test.ts',
  'src/runtime/npmPlugin/builder.alipayTemplate.test.ts',
  'src/runtime/npmPlugin/builder.concurrent.test.ts',
  'src/runtime/npmPlugin/builder.core.test.ts',
  'src/runtime/npmPlugin/service.test.ts',
  'src/runtime/scanPlugin/styleEntries/entries.test.ts',
  'src/runtime/scanPlugin/styleEntries/index.test.ts',
  'src/runtime/webPlugin.test.ts',
  'src/runtime/__tests__/buildService.test.ts',
  'src/cli/analyze/dashboard.test.ts',
  'src/cli/loadConfig.test.ts',
  'src/cli/upload/builtProject.test.ts',
  'src/plugins/css/shared/preprocessor.test.ts',
  'src/runtime/buildPlugin/independent.test.ts',
  'src/runtime/buildPlugin/service.test.ts',
  'src/runtime/buildPlugin/workers.test.ts',
  'src/runtime/npmPlugin/builder.define.test.ts',
]

const sharedCoverageOptions = {
  all: false,
  clean: false,
  exclude: [
    '**/dist/**',
  ],
}

const packageDir = import.meta.dirname

export default defineProject({
  define: {
    'process.env.__TEST__': JSON.stringify(true),
  },
  test: {
    sequence: {
      groupOrder: 100,
    },
    dir: packageDir,
    exclude: projectTestExcludes,
    alias: [
      {
        find: /^@weapp-core\/constants$/,
        replacement: path.resolve(packageDir, '../..', '@weapp-core/constants/src/index.ts'),
      },
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
        find: /^wevu\/store$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu/src/store/index.ts'),
      },
      {
        find: /^wevu\/api$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu/src/api.ts'),
      },
      {
        find: /^wevu\/fetch$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu/src/fetch.ts'),
      },
      {
        find: /^wevu\/router$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu/src/router.ts'),
      },
      {
        find: /^wevu\/vue-demi$/,
        replacement: path.resolve(packageDir, '../..', 'packages-runtime/wevu/src/vue-demi.ts'),
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
      {
        find: 'weapp-vite/auto-routes',
        replacement: path.resolve(packageDir, './src/auto-routes.ts'),
      },
    ],
    globals: true,
    hookTimeout: 60_000,
    sharedViteServer: false,
    testTimeout: 120_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'weapp-vite-fast',
          sequence: {
            groupOrder: 100,
          },
          include: createFastTestIncludes(projectTestIncludes),
          exclude: [
            ...projectTestExcludes,
            ...serialTestFiles,
          ],
          // @ts-ignore
          coverage: createProjectCoverage('packages/weapp-vite/fast', sharedCoverageOptions),
        },
      },
      {
        extends: true,
        test: {
          name: 'weapp-vite-serial',
          sequence: {
            groupOrder: 101,
          },
          globalSetup: [path.resolve(packageDir, '../../vitest.globalSetup.mjs')],
          exclude: [...projectTestExcludes, ...parallelFixtureTests],
          include: [...serialFixtureTestIncludes, ...serialTestFiles],
          fileParallelism: false,
          // @ts-ignore
          coverage: createProjectCoverage('packages/weapp-vite/serial', sharedCoverageOptions),
        },
      },
    ],
  },
})
