import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

const projectTestIncludes = [
  'test/**/*.test.ts',
  'test/**/*.spec.ts',
  'src/**/*.test.ts',
  'src/**/*.spec.ts',
]

const projectTestExcludes = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-*/**',
  '**/.weapp-vite/**',
  '**/coverage/**',
]

const serialTestFiles = [
  'test/**/*.test.ts',
  'test/**/*.spec.ts',
  'test/asset.test.ts',
  'test/auto-import.test.ts',
  'test/auto.import.test.ts',
  'test/basic.test.ts',
  'test/build-npm.test.ts',
  'test/build.test.ts',
  'test/import-umd.test.ts',
  'test/lib-mode.test.ts',
  'test/mixjs.test.ts',
  'test/release.test.ts',
  'test/resolve-deps.test.ts',
  'test/shared-chunk-modes.matrix.test.ts',
  'test/subPackages-dependencies.test.ts',
  'test/subPackages-shared-styles.test.ts',
  'test/subPackages.test.ts',
  'test/subpackage-dayjs.test.ts',
  'test/subpackage-npm-no-main.test.ts',
  'test/subpackage-npm-normal.test.ts',
  'test/subpackage-root-util.test.ts',
  'test/subpackage-shared-chunks-app.test.ts',
  'test/tabbar-appbar.test.ts',
  'test/watch-no-npm.test.ts',
  'test/watch-no-subpackage.test.ts',
  'test/watch-rebuild.test.ts',
  'test/watch-template-rebuild.test.ts',
  'test/watch.test.ts',
  'test/web.test.ts',
  'test/worker-shared.test.ts',
  'test/wxs-project.test.ts',
  'test/runtime/autoImportNavigationIntegration.test.ts',
  'test/runtime/autoImportService.test.ts',
  'test/runtime/supportFiles.integration.test.ts',
  'test/runtime/vueTemplateAutoImport.test.ts',
  'test/vue/transform-plugin.test.ts',
  'test/vue/vue-watch.test.ts',
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

export default defineProject({
  define: {
    'process.env.__TEST__': JSON.stringify(true),
  },
  test: {
    sequence: {
      groupOrder: 100,
    },
    dir: __dirname,
    include: projectTestIncludes,
    exclude: projectTestExcludes,
    alias: [
      {
        find: '@/',
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
      {
        find: /^weapp-vite$/,
        replacement: path.resolve(__dirname, './src/index.ts'),
      },
      {
        find: /^weapp-vite\/config$/,
        replacement: path.resolve(__dirname, './src/config.ts'),
      },
      {
        find: /^wevu$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu/src/index.ts'),
      },
      {
        find: /^wevu\/compiler$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu-compiler/src/index.ts'),
      },
      {
        find: /^wevu\/jsx-runtime$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu/src/jsx-runtime.ts'),
      },
      {
        find: /^wevu\/store$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu/src/store/index.ts'),
      },
      {
        find: /^wevu\/api$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu/src/api.ts'),
      },
      {
        find: /^wevu\/fetch$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu/src/fetch.ts'),
      },
      {
        find: /^wevu\/router$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu/src/router.ts'),
      },
      {
        find: /^wevu\/vue-demi$/,
        replacement: path.resolve(__dirname, '../..', 'packages-runtime/wevu/src/vue-demi.ts'),
      },
      {
        find: /^@wevu\/compiler$/,
        replacement: path.resolve(__dirname, '../wevu-compiler/src/index.ts'),
      },
      {
        find: /^@weapp-core\/shared$/,
        replacement: path.resolve(__dirname, '../..', '@weapp-core/shared/src/index.ts'),
      },
      {
        find: /^@weapp-core\/shared\/node$/,
        replacement: path.resolve(__dirname, '../..', '@weapp-core/shared/src/node.ts'),
      },
      {
        find: /^@weapp-core\/shared\/fs$/,
        replacement: path.resolve(__dirname, '../..', '@weapp-core/shared/src/fs/index.ts'),
      },
      {
        find: 'weapp-vite/auto-routes',
        replacement: path.resolve(__dirname, './src/auto-routes.ts'),
      },
    ],
    globals: true,
    hookTimeout: 60_000,
    testTimeout: 120_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'weapp-vite-fast',
          sequence: {
            groupOrder: 100,
          },
          include: projectTestIncludes,
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
          exclude: projectTestExcludes,
          include: serialTestFiles,
          fileParallelism: false,
          // @ts-ignore
          coverage: createProjectCoverage('packages/weapp-vite/serial', sharedCoverageOptions),
        },
      },
    ],
  },
})
