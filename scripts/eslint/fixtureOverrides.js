// 这些文件保留示例输出或刻意反例；仅调整对应规则，不豁免其他源码。
export const fixtureOverrides = [{
  files: [
    'apps/socket-io-chat/server/httpApp.ts',
    'apps/subpackage-shared-chunks/src/components/HelloWorld/HelloWorld.ts',
    'apps/wevu-comprehensive-demo/src/pages/store-shared/index.vue',
  ],
  rules: {
    // 生命周期、分包与请求示例通过这些日志呈现观察结果和失败原因。
    'no-console': ['warn', { allow: ['error'] }],
  },
}, {
  files: [
    'apps/vite-native-ts/miniprogram/pages/test/require.ts',
    'apps/vite-native/pages/test/require.ts',
    'apps/wevu-comprehensive-demo/src/pages/store/index.vue',
  ],
  rules: {
    // 生命周期、分包与请求示例通过这些日志呈现观察结果和失败原因。
    'no-console': ['warn', { allow: ['error', 'log'] }],
  },
}, {
  files: [
    '@weapp-core/init/templates/wevu-tdesign/src/app.vue',
    '@weapp-core/init/templates/wevu-tdesign/src/pages/index/index.vue',
    '@weapp-core/init/templates/wevu/src/app.vue',
    '@weapp-core/init/templates/wevu/src/pages/index/index.vue',
    'apps/multi-platform-wevu-tdesign-demo/src/app.vue',
    'apps/raw-ts/miniprogram/app.ts',
    'apps/raw-ts/miniprogram/pages/index/index.ts',
    'apps/rollup-watcher/src/index.js',
    'apps/rollup-watcher/watch.ts',
    'apps/socket-io-chat/server/index.ts',
    'apps/subpackage-shared-chunks/src/action/test1.ts',
    'apps/subpackage-shared-chunks/src/packages/marketing/poster.ts',
    'apps/subpackage-shared-chunks/src/packages/order/detail.ts',
    'apps/subpackage-shared-chunks/src/packages/order/index.ts',
    'apps/subpackage-shared-chunks/src/packages/profile/index.ts',
    'apps/subpackage-shared-chunks/src/packages/profile/settings.ts',
    'apps/subpackage-shared-chunks/src/pages/index/index.ts',
    'apps/vite-native-skyline/pages/index/index.js',
    'apps/vite-native-ts-skyline/miniprogram/app.ts',
    'apps/vite-native-ts/miniprogram/app.ts',
    'apps/vite-native-ts/miniprogram/components/newcom/newcom.ts',
    'apps/vite-native-ts/miniprogram/pages/index/index.ts',
    'apps/vite-native-ts/miniprogram/workers/a.ts',
    'apps/vite-native-ts/miniprogram/workers/aaaaaa.ts',
    'apps/vite-native-ts/miniprogram/workers/index.js',
    'apps/vite-native-ts/miniprogram/workers/lala.ts',
    'apps/vite-native-ts/miniprogram/workers/other.ts',
    'apps/vite-native-ts/miniprogram/workers/shared.ts',
    'apps/vite-native/app.js',
    'apps/vite-native/components/HelloWorld/index.ts',
    'apps/vite-native/components/avatar/avatar.ts',
    'apps/vite-native/index.ts',
    'apps/vite-native/packageA/index.js',
    'apps/vite-native/packageA/pages/cat.ts',
    'apps/vite-native/packageA/pages/dog.ts',
    'apps/vite-native/packageA/pages/index.wxs.ts',
    'apps/vite-native/packageB/index.ts',
    'apps/vite-native/packageB/pages/apple.js',
    'apps/vite-native/packageB/pages/banana.ts',
    'apps/vite-native/packageC/index.js',
    'apps/vite-native/packageC/pages/cat.ts',
    'apps/vite-native/packageC/pages/dog.ts',
    'apps/vite-native/packageC/pages/index.wxs.ts',
    'apps/vite-native/pages/LoveFromChina/LoveFromChina.ts',
    'apps/vite-native/pages/LoveFromChina/index.ts',
    'apps/vite-native/pages/dayjs/index.ts',
    'apps/vite-native/pages/index/page.json.ts',
    'apps/vite-native/pages/index/test.ts',
    'apps/vite-native/stores/index.js',
    'apps/vite-native/utils/cos.ts',
    'apps/vite-native/workers/index.js',
    'apps/weapp-wechat-zhihu/pages/answer/answer.ts',
    'apps/weapp-wechat-zhihu/pages/discovery/discovery.ts',
    'apps/weapp-wechat-zhihu/pages/index/index.ts',
    'apps/weapp-wechat-zhihu/pages/more/more.ts',
    'apps/weapp-wechat-zhihu/pages/question/question.ts',
    'apps/weapp-wechat-zhihu/utils/util.ts',
    'apps/wevu-bug/src/app.vue',
    'apps/wevu-bug/src/pages/index/index.vue',
    'apps/wevu-comprehensive-demo/src/app.vue',
    'apps/wevu-comprehensive-demo/src/pages/lifecycle/index.vue',
    'apps/wevu-comprehensive-demo/src/pages/setup/index.vue',
    'apps/wevu-comprehensive-demo/src/pages/vue-events/index.vue',
    'apps/wevu-comprehensive-demo/src/pages/vue-script-setup/index.vue',
    'apps/wevu-comprehensive-demo/src/pages/wevu-hooks/index.vue',
    'apps/wevu-vue-sfc-recording-demo/src/app.vue',
    'e2e-apps/wevu-features/src/pages/router-coverage/index.vue',
    'packages/weapp-vite/test/vue/ExampleComponent.vue',
  ],
  rules: {
    // 生命周期、分包与请求示例通过这些日志呈现观察结果和失败原因。
    'no-console': ['warn', { allow: ['log'] }],
  },
}, {
  files: [
    'apps/vite-native/components/chart/index.js',
  ],
  rules: {
    // 生命周期、分包与请求示例通过这些日志呈现观察结果和失败原因。
    'no-console': ['warn', { allow: ['warn'] }],
  },
}, {
  files: ['apps/api-extractor-vue-types-demo/src/{component,props}.ts'],
  rules: {
    // 此示例只提取 Vue 的公开声明，不运行 Wevu 小程序实例。
    'wevu/no-risky-api': 'off',
  },
}, {
  files: [
    'apps/raw-ts/miniprogram/utils/util.ts',
    'apps/vite-native-ts-skyline/miniprogram/utils/util.ts',
    'apps/vite-native-ts/miniprogram/utils/util.ts',
    'apps/weapp-wechat-zhihu/utils/util.ts',
    'apps/socket-io-chat/miniprogram/pages/moments/index.ts',
    'apps/socket-io-chat/server/socketServer.ts',
    'apps/socket-io-chat/web/src/views/{AxiosView,FetchView,GraphqlView}.vue',
    'e2e-apps/github-issues/src/pages/issue-322/index.vue',
    'packages-runtime/web/src/plugin/scanConfig.ts',
    'packages/weapp-ide-cli/src/i18n.ts',
    'packages/weapp-vite/src/runtime/autoImport/htmlCustomData.ts',
    'packages/weapp-vite/src/runtime/chunkStrategy/naming.ts',
  ],
  rules: {
    // 已核对为可提升的函数声明；变量、类及其他声明仍检查初始化顺序。
    'ts/no-use-before-define': ['warn', { functions: false }],
  },
}, {
  files: [
    'apps/plugin-demo/package.json',
    'apps/vite-native/package.json',
    'apps/vite-native/app.js',
    'apps/vite-native/package{A,C}/index.js',
    'apps/vite-native/package{A,C}/pages/cat.ts',
    'apps/vite-native/packageB/pages/apple.js',
    'apps/vite-native/subpackage-demos/{cross-subpackage-shared,main-and-sub-shared}.ts',
    'packages/weapp-vite/test/context/{loadDefaultConfig,scan}.test.ts',
  ],
  rules: {
    // 分包 fixture 保留 CJS/ESM 的 lodash 依赖图，配置快照沿用其 omit 语义。
    'e18e/ban-dependencies': ['warn', { allowed: ['lodash', 'lodash-es'] }],
  },
}, {
  files: ['apps/vite-native/tsup.config.ts'],
  rules: {
    // 这是独立的 WXS/esbuild 对照构建，保留 ES5、CJS、shim 与 esbuildOptions 行为。
    'e18e/ban-dependencies': ['warn', { allowed: ['tsup'] }],
  },
}, {
  files: ['apps/socket-io-chat/server/{httpApp,routes}.ts'],
  rules: {
    // 服务端示例验证 Express 中间件与 Socket.IO 共用 HTTP 服务的协议。
    'e18e/ban-dependencies': ['warn', { allowed: ['express'] }],
  },
}, {
  files: [
    'e2e-apps/lib-mode/scripts/prepare-type-fixtures.mjs',
    'packages/weapp-ide-cli/src/cli/minidev.ts',
  ],
  rules: {
    // 保留跨平台命令解析、stdio、环境继承与上游 ExecaError 错误类型。
    'e18e/ban-dependencies': ['warn', { allowed: ['execa'] }],
  },
}, {
  files: ['packages/weapp-vite/src/utils/version.ts'],
  rules: {
    // Node/Deno/Bun 的最低版本校验沿用 npm semver 的范围和预发布比较规则。
    'e18e/ban-dependencies': ['warn', { allowed: ['semver'] }],
  },
}, {
  files: [
    'scripts/check-catalog-changeset.ts',
    'scripts/check-e2e-ide-shared-launch.ts',
    'skills/scripts/validate-skills-yaml.mjs',
  ],
  rules: {
    // 这些检查器依赖现有 glob、忽略项及绝对路径选项的扫描契约。
    'e18e/ban-dependencies': ['warn', { allowed: ['fast-glob'] }],
  },
}, {
  files: ['e2e-apps/github-issues/src/components/issue-328/ValueProbe/index.vue'],
  rules: {
    // issue-328 刻意保留必填 prop 与默认值组合，验证 null/undefined 和更新行为。
    'vue/no-required-prop-with-default': 'off',
  },
}, {
  files: ['e2e-apps/github-issues/src/components/issue-627/ReservedPropsProbe/index.vue'],
  rules: {
    // issue-627 必须原样声明宿主保留 prop，验证编译器与真实 properties 的兼容行为。
    'vue/no-restricted-props': 'off',
  },
}, {
  files: ['website/.vitepress/components/TechBackground.vue'],
  rules: {
    // VitePress 的浏览器 Vue 组件透传 class，不经过小程序 properties。
    'vue/no-restricted-props': 'off',
  },
}, {
  files: ['e2e-apps/github-issues/src/pages/issue-{448,457}/index.vue'],
  rules: {
    // 这两个页面专门验收全局 polyfill 注入；相关 Web runtime suite 显式启用 appPrelude.webRuntime。
    'mini-program/no-implicit-runtime-polyfill': 'off',
  },
}, {
  files: [
    'e2e-apps/request-clients-real-native/src/app.ts',
    'e2e-apps/request-clients-real-native/src/pages/fetch/index.ts',
  ],
  rules: {
    // 原生 Page fixture 已显式配置 appPrelude.webRuntime，此处探测并调用注入后的请求全局。
    'mini-program/no-implicit-runtime-polyfill': 'off',
  },
}]
