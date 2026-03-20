# fs-extra 使用情况报告

日期：2026-03-20

## 统计口径

- 统计范围：`packages`、`apps`、`templates`、`website`、`docs`、`e2e`、`e2e-apps`
- 排除目录：`dist`、`node_modules`
- “真实使用”定义：
  - `import ... from 'fs-extra'`
  - `import 'fs-extra'`
  - `require('fs-extra')`
- “声明依赖”定义：
  - 项目 `package.json` 中存在 `dependencies`、`devDependencies`、`peerDependencies`、`optionalDependencies` 任一项的 `fs-extra`

## 汇总

真实使用 `fs-extra` 的项目/项目域共 9 个：

| 项目                         | package.json 声明 fs-extra | 命中文件数 |
| ---------------------------- | -------------------------: | ---------: |
| `apps/vite-native`           |                         否 |          3 |
| `e2e`                        |                         否 |         56 |
| `packages/create-weapp-vite` |                         是 |          8 |
| `packages/rolldown-require`  |                         否 |          2 |
| `packages/weapp-ide-cli`     |                         是 |          6 |
| `packages/weapp-vite`        |                         是 |        129 |
| `packages/web`               |                         是 |          2 |
| `packages/wevu`              |                         否 |          2 |
| `packages/wevu-compiler`     |                         是 |          7 |

声明了 `fs-extra` 依赖的项目共 5 个：

- `packages/create-weapp-vite`
- `packages/weapp-ide-cli`
- `packages/weapp-vite`
- `packages/web`
- `packages/wevu-compiler`

未声明但源码实际使用了 `fs-extra` 的项目/项目域：

- `apps/vite-native`
- `e2e`
- `packages/rolldown-require`
- `packages/wevu`

## 明细

### `apps/vite-native`

- `apps/vite-native/touch.ts`
- `apps/vite-native/scripts/extract.ts`
- `apps/vite-native/vite.config.ts`

### `e2e`

- `e2e/helpers/fs-copy-race-guard.cjs`
- `e2e/template-e2e.utils.ts`
- `e2e/wevu-runtime.utils.ts`
- `e2e/utils/hmr-helpers.ts`
- `e2e/utils/buildLog.ts`
- `e2e/ci/platform-build.test.ts`
- `e2e/ci/hmr-shared-chunks-auto.test.ts`
- `e2e/ci/wevu-features.build.test.ts`
- `e2e/ci/script-setup-macros-mapping.build.test.ts`
- `e2e/ci/wevu-runtime.platforms.test.ts`
- `e2e/ci/wevu-runtime.platform-dependency-modes.test.ts`
- `e2e/ci/wevu-runtime.hmr.test.ts`
- `e2e/ci/template-weapp-vite-wevu-template.auto-import-dts.test.ts`
- `e2e/ide/github-issues.runtime.test.ts`
- `e2e/ci/hmr-modify.test.ts`
- `e2e/ci/auto-routes-define-app-json.test.ts`
- `e2e/ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts`
- `e2e/ci/github-issues.build.test.ts`
- `e2e/ci/issue-814-tailwind-dynamic-class.e2e.test.ts`
- `e2e/ide/app-lifecycle.test.ts`
- `e2e/ci/plugin-demo.build.test.ts`
- `e2e/ci/wevu-vue-demo.template-compat.build.test.ts`
- `e2e/ide/wevu-features.runtime.test.ts`
- `e2e/ci/hmr-html-template.test.ts`
- `e2e/ci/object-literal-bind-prop.test.ts`
- `e2e/ci/auto-import-vue-sfc.test.ts`
- `e2e/ci/wevu-vue-demo.script-setup.macros-mapping.integration.test.ts`
- `e2e/ide/issue-340-hoist.runtime.test.ts`
- `e2e/ci/auto-routes-hmr.test.ts`
- `e2e/ide/tdesign-miniprogram-starter-retail.runtime.test.ts`
- `e2e/ci/wevu-runtime.inline-object-reactivity.integration.test.ts`
- `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts`
- `e2e/ci/alipay-smoke.test.ts`
- `e2e/ci/chunk-modes.e2e.test.ts`
- `e2e/ci/hmr-app-config.test.ts`
- `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test.ts`
- `e2e/ci/wevu-runtime.template-compat.integration.test.ts`
- `e2e/ide/subpackage-shared-strategy-complex.runtime.test.ts`
- `e2e/ci/hmr-rename.test.ts`
- `e2e/ide/index.test.ts`
- `e2e/ci/lib-mode.e2e.test.ts`
- `e2e/ci/hmr-delete.test.ts`
- `e2e/ide/wevu-subpackage-placement.runtime.test.ts`
- `e2e/ci/npm-build-race.e2e.test.ts`
- `e2e/ide/plugin-demo.runtime.test.ts`
- `e2e/ci/style-import-vue.test.ts`
- `e2e/ide/lifecycle-compare.test.ts`
- `e2e/ci/hmr-rapid.test.ts`
- `e2e/ide/wevu-watch.test.ts`
- `e2e/ide/auto-routes-define-app-json.runtime.test.ts`
- `e2e/ci/subpackage-shared-strategy-complex.e2e.test.ts`
- `e2e/ci/hmr-add.test.ts`
- `e2e/ci/wevu-vue-demo.script-setup.emit.integration.test.ts`
- `e2e/ci/hmr-layouts.test.ts`
- `e2e/ci/wevu-subpackage-placement.build.test.ts`
- `e2e/ci/issue-340-hoist.e2e.test.ts`

### `packages/create-weapp-vite`

- `packages/create-weapp-vite/src/utils/fs.ts`
- `packages/create-weapp-vite/scripts/generate-template-catalog.ts`
- `packages/create-weapp-vite/src/cli.ts`
- `packages/create-weapp-vite/test/createProject.test.ts`
- `packages/create-weapp-vite/test/index.test.ts`
- `packages/create-weapp-vite/src/createProject.ts`
- `packages/create-weapp-vite/test/templates.test.ts`
- `packages/create-weapp-vite/scripts/shared.ts`

### `packages/rolldown-require`

- `packages/rolldown-require/test/esbuild.test.ts`
- `packages/rolldown-require/test/index.test.ts`

### `packages/weapp-ide-cli`

- `packages/weapp-ide-cli/src/cli/resolver.ts`
- `packages/weapp-ide-cli/src/cli/prompt.ts`
- `packages/weapp-ide-cli/src/cli/config-command.ts`
- `packages/weapp-ide-cli/src/runtime/platform.ts`
- `packages/weapp-ide-cli/src/config/custom.ts`
- `packages/weapp-ide-cli/src/config/resolver.ts`

### `packages/weapp-vite`

- `packages/weapp-vite/src/utils/weappConfig.test.ts`
- `packages/weapp-vite/src/runtime/autoRoutesPlugin.test.ts`
- `packages/weapp-vite/src/plugins/autoImport.test.ts`
- `packages/weapp-vite/scripts/release.ts`
- `packages/weapp-vite/src/utils/projectConfig.test.ts`
- `packages/weapp-vite/scripts/generate-weapp-builtin-html-tags.mjs`
- `packages/weapp-vite/src/plugins/asset.ts`
- `packages/weapp-vite/src/runtime/scanPlugin/styleEntries/index.ts`
- `packages/weapp-vite/src/runtime/scanPlugin/styleEntries/entries.ts`
- `packages/weapp-vite/src/cli/commands/analyze.ts`
- `packages/weapp-vite/src/plugins/hooks/useLoadEntry/loadEntry/resolve.ts`
- `packages/weapp-vite/src/runtime/lib.test.ts`
- `packages/weapp-vite/src/plugins/hooks/useLoadEntry/loadEntry/index.ts`
- `packages/weapp-vite/src/plugins/hooks/useLoadEntry/loadEntry/template.ts`
- `packages/weapp-vite/src/utils/projectConfig.ts`
- `packages/weapp-vite/src/utils/entryResolve.ts`
- `packages/weapp-vite/src/utils/file.test.ts`
- `packages/weapp-vite/src/utils/file.ts`
- `packages/weapp-vite/src/plugins/workers.ts`
- `packages/weapp-vite/src/plugins/wxs.test.ts`
- `packages/weapp-vite/src/cache/file.test.ts`
- `packages/weapp-vite/src/plugins/wxs.ts`
- `packages/weapp-vite/src/cache/file.ts`
- `packages/weapp-vite/test/asset.test.ts`
- `packages/weapp-vite/src/plugins/css.ts`
- `packages/weapp-vite/test/auto-import.test.ts`
- `packages/weapp-vite/src/runtime/lib.ts`
- `packages/weapp-vite/bench/utils.ts`
- `packages/weapp-vite/test/subpackage-npm-no-main.test.ts`
- `packages/weapp-vite/src/runtime/__tests__/wxmlService.test.ts`
- `packages/weapp-vite/test/tabbar-appbar.test.ts`
- `packages/weapp-vite/src/utils/weappConfig.ts`
- `packages/weapp-vite/test/subPackages-shared-styles.test.ts`
- `packages/weapp-vite/src/runtime/__tests__/autoRoutesCollect.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/pageLayout.ts`
- `packages/weapp-vite/test/build-npm.test.ts`
- `packages/weapp-vite/src/schematics.ts`
- `packages/weapp-vite/src/plugins/utils/invalidateEntry/cssGraph.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/bundle.ts`
- `packages/weapp-vite/src/plugins/vue/transform/pageLayout.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/fallbackEntries.ts`
- `packages/weapp-vite/test/demo/dist.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/plugin.ts`
- `packages/weapp-vite/test/runtime/autoImportService.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/collectVuePages.ts`
- `packages/weapp-vite/test/demo/vite-native-ts-skyline/index.test.ts`
- `packages/weapp-vite/test/runtime/autoImportNavigationIntegration.test.ts`
- `packages/weapp-vite/src/plugins/utils/cache.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/bundle.platform.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/usingComponentResolver.ts`
- `packages/weapp-vite/test/plugins/sidecarWatcherLogging.test.ts`
- `packages/weapp-vite/test/plugins/invalidateEntry.test.ts`
- `packages/weapp-vite/src/plugins/vue/transform/compileVueFile.test.ts`
- `packages/weapp-vite/src/runtime/tsconfigSupport.ts`
- `packages/weapp-vite/test/shared-chunk-modes.matrix.test.ts`
- `packages/weapp-vite/test/runtime/vueTemplateAutoImport.test.ts`
- `packages/weapp-vite/src/runtime/tsconfigSupport.test.ts`
- `packages/weapp-vite/test/subPackages-dependencies.test.ts`
- `packages/weapp-vite/src/runtime/oxcRuntime.ts`
- `packages/weapp-vite/test/schematics.test.ts`
- `packages/weapp-vite/src/runtime/buildPlugin/pluginDemo.test.ts`
- `packages/weapp-vite/src/runtime/buildPlugin/layoutBuild.test.ts`
- `packages/weapp-vite/src/runtime/npmPlugin/service.ts`
- `packages/weapp-vite/test/lib-mode.test.ts`
- `packages/weapp-vite/src/runtime/autoRoutesPlugin/service.ts`
- `packages/weapp-vite/src/runtime/npmPlugin/builder.core.test.ts`
- `packages/weapp-vite/src/plugins/css/shared/preprocessor.ts`
- `packages/weapp-vite/src/runtime/autoRoutesPlugin/candidates.ts`
- `packages/weapp-vite/test/watch-no-npm.test.ts`
- `packages/weapp-vite/src/runtime/npmPlugin/cache.ts`
- `packages/weapp-vite/test/vue/vue-watch.test.ts`
- `packages/weapp-vite/test/auto.import.test.ts`
- `packages/weapp-vite/src/runtime/npmPlugin/service.test.ts`
- `packages/weapp-vite/test/subpackage-dayjs.test.ts`
- `packages/weapp-vite/test/vue/fallback-js-emission.test.ts`
- `packages/weapp-vite/src/runtime/npmPlugin/builder.ts`
- `packages/weapp-vite/src/runtime/config/internal/tsconfigPaths.ts`
- `packages/weapp-vite/src/runtime/npmPlugin/builder.concurrent.test.ts`
- `packages/weapp-vite/test/shared-chunks.test.ts`
- `packages/weapp-vite/src/runtime/libDts.test.ts`
- `packages/weapp-vite/src/runtime/jsonPlugin.ts`
- `packages/weapp-vite/test/auto-routes.test.ts`
- `packages/weapp-vite/test/style.test.ts`
- `packages/weapp-vite/test/vue/wevu-defaults.test.ts`
- `packages/weapp-vite/test/vue/transform-plugin.test.ts`
- `packages/weapp-vite/src/runtime/libDts.ts`
- `packages/weapp-vite/test/scan.test.ts`
- `packages/weapp-vite/src/runtime/wxmlPlugin.ts`
- `packages/weapp-vite/test/vue/style-import-resolution.test.ts`
- `packages/weapp-vite/src/runtime/npmPlugin/builder.alipay.test.ts`
- `packages/weapp-vite/test/vue/json-macros.test.ts`
- `packages/weapp-vite/src/runtime/autoImport/externalMetadata.ts`
- `packages/weapp-vite/test/mixjs.test.ts`
- `packages/weapp-vite/test/vue/jsx-auto-using-components.test.ts`
- `packages/weapp-vite/test/resolve-deps.test.ts`
- `packages/weapp-vite/test/vue/style-pipeline.test.ts`
- `packages/weapp-vite/test/watch-template-rebuild.test.ts`
- `packages/weapp-vite/src/runtime/autoImport/service/outputs/sync.ts`
- `packages/weapp-vite/test/vue/script-setup-auto-using-components-barrel.test.ts`
- `packages/weapp-vite/test/vue/config-blocks.test.ts`
- `packages/weapp-vite/test/subpackage-npm-normal.test.ts`
- `packages/weapp-vite/src/runtime/autoImport/service/outputs/manifest.ts`
- `packages/weapp-vite/src/runtime/autoImport/externalMetadata.test.ts`
- `packages/weapp-vite/test/wxs-project.test.ts`
- `packages/weapp-vite/test/vue/sfc-src.test.ts`
- `packages/weapp-vite/test/vue/setdata-pick.test.ts`
- `packages/weapp-vite/src/runtime/autoImport/service/registry.ts`
- `packages/weapp-vite/src/runtime/autoImport/service/resolver.ts`
- `packages/weapp-vite/test/fs-watch.test.ts`
- `packages/weapp-vite/test/independent-subpackage.test.ts`
- `packages/weapp-vite/src/runtime/config/internal/loadConfig.ts`
- `packages/weapp-vite/test/watch-rebuild.test.ts`
- `packages/weapp-vite/test/basic.test.ts`
- `packages/weapp-vite/test/vue/script-setup-define-options.test.ts`
- `packages/weapp-vite/src/runtime/autoImport/externalMetadata.edge.test.ts`
- `packages/weapp-vite/test/subPackages.test.ts`
- `packages/weapp-vite/test/watch-no-subpackage.test.ts`
- `packages/weapp-vite/src/runtime/autoImport/service/resolver.test.ts`
- `packages/weapp-vite/src/runtime/autoImport/service/metadata.ts`
- `packages/weapp-vite/test/worker-shared.test.ts`
- `packages/weapp-vite/test/import-umd.test.ts`
- `packages/weapp-vite/test/vue/app-vue.test.ts`
- `packages/weapp-vite/test/vue/plugins.misc.test.ts`
- `packages/weapp-vite/test/watch.test.ts`
- `packages/weapp-vite/test/subpackage-root-util.test.ts`
- `packages/weapp-vite/test/wxs/babel.test.ts`
- `packages/weapp-vite/test/fixtures/asset/gen.ts`
- `packages/weapp-vite/test/analyze-command-web.test.ts`
- `packages/weapp-vite/test/ast/index.test.ts`

### `packages/web`

- `packages/web/src/plugin/files.ts`
- `packages/web/src/plugin/path.ts`

### `packages/wevu`

- `packages/wevu/scripts/sync-components-from-docs.mjs`
- `packages/wevu/scripts/generate-weapp-intrinsic-elements.mjs`

### `packages/wevu-compiler`

- `packages/wevu-compiler/src/plugins/utils/cache.ts`
- `packages/wevu-compiler/src/plugins/utils/cache.test.ts`
- `packages/wevu-compiler/src/plugins/vue/transform/config.ts`
- `packages/wevu-compiler/src/plugins/vue/transform/defineOptions/inline.test.ts`
- `packages/wevu-compiler/src/plugins/vue/transform/defineOptions/inline.ts`
- `packages/wevu-compiler/src/plugins/vue/transform/jsonMacros/execute.ts`
- `packages/wevu-compiler/src/plugins/vue/transform/compileVueFile/defineOptions.behavior.test.ts`
