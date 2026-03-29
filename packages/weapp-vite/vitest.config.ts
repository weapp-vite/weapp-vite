import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

const serialTestFiles = [
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
  'src/runtime/npmPlugin/builder.alipay.test.ts',
  'src/runtime/npmPlugin/builder.alipayTemplate.test.ts',
  'src/runtime/npmPlugin/builder.concurrent.test.ts',
  'src/runtime/npmPlugin/builder.core.test.ts',
  'src/runtime/npmPlugin/service.test.ts',
  'src/runtime/scanPlugin/styleEntries/entries.test.ts',
  'src/runtime/scanPlugin/styleEntries/index.test.ts',
  'src/runtime/webPlugin.test.ts',
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
    dir: __dirname,
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
    projects: [
      {
        extends: true,
        test: {
          name: 'weapp-vite-fast',
          exclude: serialTestFiles,
          // @ts-ignore
          coverage: createProjectCoverage('packages/weapp-vite/fast', sharedCoverageOptions),
        },
      },
      {
        extends: true,
        test: {
          name: 'weapp-vite-serial',
          include: serialTestFiles,
          fileParallelism: false,
          // @ts-ignore
          coverage: createProjectCoverage('packages/weapp-vite/serial', sharedCoverageOptions),
        },
      },
    ],
  },
})
