# 微信 IDE DOM 验收清单

本文件由 `e2e/scripts/domAcceptanceReport/inventory.ts` 从 exhaustive manifest 和 TypeScript AST 生成。它记录源码中的计划接入情况，不代表运行通过。最终验收以同一提交的严格 IDE JSON 报告为准。

字面量参数表与模板 runner 子任务已展开；动态表会显式标注。一个 case 内的多路由操作保留在 routes/operations；模板的完整 route/checkpoint 定义见 plan source。GitHub aggregate 的直接测试导入递归展开。

JSON 中的 sources 保存测试和本地 E2E 依赖的 SHA-256；修改共享计划、helper 或 manifest 后，CI 会要求重新生成清单。

- 任务：92；微信：89；范围外：3。
- 展开的 case 声明：230；已接入计划：230；缺计划：0。
- 未解析的动态参数化：0；未发现 case 声明的微信任务：0。

重新生成：`node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --write`。

## 任务覆盖

| Task                                                                                      | Providers          | Cases | Plans | Missing | Scope        |
| ----------------------------------------------------------------------------------------- | ------------------ | ----: | ----: | ------: | ------------ |
| ide/app-lifecycle.test.ts                                                                 | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/app-prelude-native.runtime.test.ts                                                    | devtools, headless |     3 |     3 |       0 | wechat       |
| ide/app-vue-hmr-alias.runtime.test.ts                                                     | devtools           |     1 |     1 |       0 | wechat       |
| ide/auto-routes-define-app-json.runtime.test.ts                                           | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/automator-bridge-wrapper-hmr.runtime.test.ts                                          | devtools           |     1 |     1 |       0 | wechat       |
| ide/automator-concurrent-sessions.runtime.test.ts                                         | devtools           |     1 |     1 |       0 | wechat       |
| ide/devtools-cli-workflow.runtime.test.ts                                                 | devtools           |     2 |     2 |       0 | wechat       |
| ide/forward-console-demo.runtime.test.ts                                                  | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.aggregate.test.ts                                               | devtools           |    65 |    65 |       0 | wechat       |
| ide/github-issues.runtime.component-instance-apis.test.ts                                 | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue448-formdata-upload.test.ts                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue547.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue558.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue615.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue621.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue642-bug7-default.test.ts                                   | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue642-bug7-performance.test.ts                               | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue642-bug8.test.ts                                           | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue779.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue826.test.ts                                                | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue852.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue868.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.issue911.test.ts                                                | devtools           |     7 |     7 |       0 | wechat       |
| ide/github-issues.runtime.issue941.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.require-async.test.ts                                           | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.slot-fallback-compiler-off.test.ts                              | devtools           |     1 |     1 |       0 | wechat       |
| ide/github-issues.runtime.subpackage-item.test.ts                                         | devtools           |     2 |     2 |       0 | wechat       |
| ide/github-issues.runtime.subpackage-user.test.ts                                         | devtools           |     2 |     2 |       0 | wechat       |
| ide/hmr-auto-classic.runtime.test.ts                                                      | devtools           |     1 |     1 |       0 | wechat       |
| ide/index.test.ts                                                                         | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/issue-340-hoist.runtime.test.ts                                                       | devtools           |     1 |     1 |       0 | wechat       |
| ide/layout-power-demo-message.runtime.test.ts                                             | devtools           |     1 |     1 |       0 | wechat       |
| ide/layout-power-demo.runtime-vendor-hmr.test.ts                                          | devtools           |     1 |     1 |       0 | wechat       |
| ide/lifecycle-compare.test.ts                                                             | devtools, headless |     4 |     4 |       0 | wechat       |
| ide/mcp-runtime-tools.runtime.test.ts                                                     | devtools           |     1 |     1 |       0 | wechat       |
| ide/plugin-demo.runtime.test.ts                                                           | devtools           |     1 |     1 |       0 | wechat       |
| ide/react-runtime-spike.runtime.test.ts                                                   | devtools, headless |     3 |     3 |       0 | wechat       |
| ide/request-clients-real-native.runtime.test.ts                                           | devtools           |     6 |     6 |       0 | wechat       |
| ide/request-clients-real.runtime.test.ts                                                  | devtools           |     7 |     7 |       0 | wechat       |
| ide/shared-styles.runtime.test.ts                                                         | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/stateful-hmr.runtime.test.ts                                                          | devtools           |     5 |     5 |       0 | wechat       |
| ide/subpackage-shared-strategy-complex.runtime.test.ts                                    | devtools, headless |     2 |     2 |       0 | wechat       |
| ide/swan-runtime.optional.test.ts                                                         | swan               |     1 |     0 |       - | out-of-scope |
| ide/tdesign-dialog-import.runtime.test.ts                                                 | devtools, headless |     2 |     2 |       0 | wechat       |
| ide/template-dev-open-all.runtime.test.ts                                                 | devtools           |    11 |    11 |       0 | wechat       |
| ide/template-multi-platform-sfc.swan.optional.test.ts                                     | swan               |     1 |     0 |       - | out-of-scope |
| ide/template-multi-platform.swan.optional.test.ts                                         | swan               |     1 |     0 |       - | out-of-scope |
| ide/template-retail-checkout.runtime.test.ts                                              | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/template-tailwindcss-dev-open-multi.runtime.test.ts                                   | devtools           |     3 |     3 |       0 | wechat       |
| ide/template-tailwindcss-tdesign-hmr.runtime.test.ts                                      | devtools           |     2 |     2 |       0 | wechat       |
| ide/template-weapp-vite-multi-platform-sfc-template.test.ts                               | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-multi-platform-template.test.ts                                   | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-tailwindcss-tdesign-template.test.ts                              | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-tailwindcss-template.test.ts                                      | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-tailwindcss-vant-template.test.ts                                 | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-template.test.ts                                                  | devtools, headless |     2 |     2 |       0 | wechat       |
| ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts | devtools           |     4 |     4 |       0 | wechat       |
| ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts                  | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test.ts     | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test.ts                    | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts  | devtools           |     3 |     3 |       0 | wechat       |
| ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts          | devtools           |     3 |     3 |       0 | wechat       |
| ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.test.ts                         | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts                            | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts                             | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/template-weapp-vite-wevu-template.test.ts                                             | devtools, headless |     2 |     2 |       0 | wechat       |
| ide/template-wevu-features-app.test.ts                                                    | devtools           |     1 |     1 |       0 | wechat       |
| ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts                                 | devtools           |     1 |     1 |       0 | wechat       |
| ide/vite-native-ts.worker.runtime.test.ts                                                 | devtools           |     1 |     1 |       0 | wechat       |
| ide/vue-mini-issue151-wevu.runtime.test.ts                                                | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-composition-api.weapp.test.ts                                                    | devtools           |     2 |     2 |       0 | wechat       |
| ide/wevu-features.runtime.behavior.test.ts                                                | devtools, headless |     9 |     9 |       0 | wechat       |
| ide/wevu-features.runtime.router.test.ts                                                  | devtools, headless |     4 |     4 |       0 | wechat       |
| ide/wevu-features.runtime.subpath.test.ts                                                 | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-jsx-tsx.hmr.runtime.test.ts                                                      | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-jsx-tsx.runtime.test.ts                                                          | devtools, headless |     3 |     3 |       0 | wechat       |
| ide/wevu-router-hmr.runtime.test.ts                                                       | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-runtime-demo.request-globals.weapp.test.ts                                       | devtools           |     2 |     2 |       0 | wechat       |
| ide/wevu-runtime-demo.vue-query.weapp.test.ts                                             | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-runtime.class-computed.weapp.test.ts                                             | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-runtime.core-hmr.test.ts                                                         | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-runtime.function-props.weapp.test.ts                                             | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-runtime.inline-object-reactivity.weapp.test.ts                                   | devtools           |     2 |     2 |       0 | wechat       |
| ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts                                   | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-runtime.shared-template-wxs.hmr.test.ts                                          | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-runtime.weapp.test.ts                                                            | devtools, headless |     6 |     6 |       0 | wechat       |
| ide/wevu-subpackage-placement.runtime.test.ts                                             | devtools           |     1 |     1 |       0 | wechat       |
| ide/wevu-vue-demo.script-setup.emit.runtime.test.ts                                       | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/wevu-watch.test.ts                                                                    | devtools           |     1 |     1 |       0 | wechat       |
| ide/chunk-modes.runtime.duplicate.test.ts                                                 | devtools, headless |     2 |     2 |       0 | wechat       |
| ide/chunk-modes.runtime.extras.test.ts                                                    | devtools, headless |     1 |     1 |       0 | wechat       |
| ide/chunk-modes.runtime.hoist.test.ts                                                     | devtools, headless |     1 |     1 |       0 | wechat       |

## ide/app-lifecycle.test.ts

### app lifecycle compare (e2e) > compares wevu app lifecycle logs against native

- Source: `e2e/ide/app-lifecycle.test.ts:231`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps`; checkpoints: `['native', 'wevu-ts', 'wevu-vue'].flatMap(variant => [ { id: \`${variant}:initial\`, route: INDEX_ROUTE, action: \`冷启动 e2e-apps/app-lifecycle-${variant} 并检查实际启动 hook 状态\`, nodes: [ { selector: '#app-lifecycle-route', text: variant === 'native' `; source: `e2e/ide/app-lifecycle.test.ts:232`
- Operations: `check(native:initial)`, `callMethod(refreshLifecycleSummary)`, `check(native:finalized)`, `check(wevu-ts:initial)`, `check(wevu-ts:finalized)`, `check(wevu-vue:initial)`, `check(wevu-vue:finalized)`

## ide/app-prelude-native.runtime.test.ts

### e2e app: app-prelude-native runtime > executes inline app prelude once even after relaunching main and subpackage pages

- Source: `e2e/ide/app-prelude-native.runtime.test.ts:85`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/app-prelude-native`; checkpoints: `ROUTES.map(({ route, label }) => ({ id: label, route, action: \`reLaunch ${label} and inspect the prelude execution log\`, nodes: [ { selector: '#route', text: label }, { selector: '#prelude-log-count', text: '1' }, { selector: '.prelude-log-`; source: `e2e/ide/app-prelude-native.runtime.test.ts:60`
- Operations: `reLaunch(route)`, `check(label)`

### e2e app: app-prelude-native runtime > keeps one prelude side effect per package scope under default require mode

- Source: `e2e/ide/app-prelude-native.runtime.test.ts:89`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/app-prelude-native`; checkpoints: `ROUTES.map(({ route, label }) => ({ id: label, route, action: \`reLaunch ${label} and inspect the prelude execution log\`, nodes: [ { selector: '#route', text: label }, { selector: '#prelude-log-count', text: '1' }, { selector: '.prelude-log-`; source: `e2e/ide/app-prelude-native.runtime.test.ts:60`
- Operations: `reLaunch(route)`, `check(label)`

### e2e app: app-prelude-native runtime > installs request runtime globals through app.prelude.js under default require mode

- Source: `e2e/ide/app-prelude-native.runtime.test.ts:93`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/app-prelude-native`; checkpoints: `[{ id: 'request-runtime', route: ROUTES[0]!.route, action: 'inspect the installed request API constructors on the first page', nodes: Object.entries(REQUEST_RUNTIME).map(([name, type]) => ({ selector: \`#runtime-${name}\`, text: \`${name}=${ty`; source: `e2e/ide/app-prelude-native.runtime.test.ts:94`
- Operations: `check(request-runtime)`

## ide/app-vue-hmr-alias.runtime.test.ts

### app.vue alias import layout HMR runtime > keeps visible page elements and bundled alias imports across app, layout, page, and dependency HMR

- Source: `e2e/ide/app-vue-hmr-alias.runtime.test.ts:441`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/app-vue-hmr-alias`; checkpoints: `[ ['initial', BASE_APP_MARKER, BASE_LAYOUT_MARKER, PAGE_MARKER, BOOTSTRAP_MARKER], ['app-update', appMarker, BASE_LAYOUT_MARKER, PAGE_MARKER, BOOTSTRAP_MARKER], ['layout-update', appMarker, layoutMarker, PAGE_MARKER, BOOTSTRAP_MARKER], ['pa`; source: `e2e/ide/app-vue-hmr-alias.runtime.test.ts:446`
- Routes: ``
- Operations: `check(initial)`, `check(app-update)`, `check(layout-update)`, `check(page-update)`, `check(dependency-update)`

## ide/auto-routes-define-app-json.runtime.test.ts

### auto-routes define app json runtime (weapp e2e) > renders routeLinks for home page with main package and subpackage routes

- Source: `e2e/ide/auto-routes-define-app-json.runtime.test.ts:35`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/auto-routes-define-app-json`; checkpoints: `[{ id: 'route-links', route: HOME_ROUTE, action: 'reLaunch home and inspect all generated navigation links', nodes: [ { selector: '.title', text: 'auto-routes 导航中心' }, { selector: '.meta', text: '主包页面：4，总入口：6' }, { selector: 'navigator', co`; source: `e2e/ide/auto-routes-define-app-json.runtime.test.ts:36`
- Routes: `/pages/home/index`
- Operations: `reLaunch(/pages/home/index)`, `check(route-links)`

## ide/automator-bridge-wrapper-hmr.runtime.test.ts

### automator bridge wrapper snapshot hmr (ide) > renders four same-length template updates while retaining page and app identity

- Source: `e2e/ide/automator-bridge-wrapper-hmr.runtime.test.ts:75`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `[ { id: 'initial', route: '/pages/hmr/index', action: '首屏检查实际模板标题和初始交互状态', nodes: [{ selector: '.title', text: 'HMR' }, { selector: '#hmr-count', text: 'count: 0' }] }, ...TEMPLATE_TITLES.map((title, index) => ({ id: \`retained:${index}\`, ro`; source: `e2e/ide/automator-bridge-wrapper-hmr.runtime.test.ts:76`
- Routes: `/pages/hmr/index`
- Operations: `reLaunch(/pages/hmr/index)`, `check(initial)`, `callMethod(increment)`, `check(retained:0)`, `check(retained:${index})`

## ide/automator-concurrent-sessions.runtime.test.ts

### automator concurrent sessions > assigns independent automator session metadata to each project

- Source: `e2e/ide/automator-concurrent-sessions.runtime.test.ts:151`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/base + e2e-apps/app-lifecycle-native`; checkpoints: `[ { id: 'base', route: INDEX_ROUTE, action: '启动第一个项目并检查其实际界面', nodes: [ { selector: '#base-greeting', text: 'Hello' }, { selector: '#base-target', text: 'Target: index snapshot' }, ], }, { id: 'native', route: INDEX_ROUTE, action: '保留第一连接并启`; source: `e2e/ide/automator-concurrent-sessions.runtime.test.ts:152`
- Operations: `check(base)`, `check(native)`

## ide/devtools-cli-workflow.runtime.test.ts

### DevTools CLI workflow runtime > opens with weapp-vite and weapp-ide-cli, screenshots, taps DOM, and exposes helpful diagnostics

- Source: `e2e/ide/devtools-cli-workflow.runtime.test.ts:560`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/weapp-vite-wevu-tailwindcss-tdesign-template`; checkpoints: `CLI_WORKFLOW_CHECKPOINTS`; source: `e2e/ide/devtools-cli-workflow.runtime.test.ts:561`
- Operations: `check(initial)`, `check(cli-tapped)`, `check(mcp-tapped)`

### DevTools CLI workflow runtime > captures screenshots from the dev hotkey after dev -o opens the project

- Source: `e2e/ide/devtools-cli-workflow.runtime.test.ts:685`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/weapp-vite-wevu-tailwindcss-tdesign-template`; checkpoints: `CLI_HOTKEY_CHECKPOINTS`; source: `e2e/ide/devtools-cli-workflow.runtime.test.ts:686`
- Operations: `check(dev-opened)`, `check(screenshot)`

## ide/forward-console-demo.runtime.test.ts

### forward-console-demo in real WeChat DevTools > keeps forwarding console output after dev HMR updates the current page

- Source: `e2e/ide/forward-console-demo.runtime.test.ts:222`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/forward-console-demo`; checkpoints: `[ { id: 'initial', route: INDEX_ROUTE, action: '检查日志演示首屏', nodes: [ { selector: '.title', text: 'Forward Console Lab' }, { selector: '.description', text: INITIAL_DESCRIPTION }, { selector: '.status-pill text', text: '0 events' }, { selecto`; source: `e2e/ide/forward-console-demo.runtime.test.ts:224`
- Operations: `check(initial)`, `tap(<missing>)`, `check(clicked)`, `check(patched)`

## ide/github-issues.runtime.aggregate.test.ts

### e2e app: github-issues / issue-289 > issue #289: compiles object-literal class bindings and runtime probe

- Source: `e2e/ide/github-issues.runtime.issue289.test.ts:25`
- Plan: registered in source; runtime verification required
- Registration: `runGithubDom`; fixture: `e2e-apps/github-issues`; checkpoints: `OBJECT_CLASSES`; source: `e2e/ide/github-issues.runtime.issue289.test.ts:35`
- Routes: `/pages/issue-289/object-literal/index`

### e2e app: github-issues / issue-289 > issue #289: compiles map-class dynamic class bindings and runtime probe

- Source: `e2e/ide/github-issues.runtime.issue289.test.ts:38`
- Plan: registered in source; runtime verification required
- Registration: `runGithubDom`; fixture: `e2e-apps/github-issues`; checkpoints: `MAP_CLASSES`; source: `e2e/ide/github-issues.runtime.issue289.test.ts:50`
- Routes: `/pages/issue-289/map-class/index`

### e2e app: github-issues / issue-289 > issue #289: compiles root-class bindings and runtime probe

- Source: `e2e/ide/github-issues.runtime.issue289.test.ts:53`
- Plan: registered in source; runtime verification required
- Registration: `runGithubDom`; fixture: `e2e-apps/github-issues`; checkpoints: `ROOT_CLASSES`; source: `e2e/ide/github-issues.runtime.issue289.test.ts:62`
- Routes: `/pages/issue-289/root-class/index`

### e2e app: github-issues / issue-289 > issue #289: compiles computed-class dynamic class bindings and runtime probe

- Source: `e2e/ide/github-issues.runtime.issue289.test.ts:65`
- Plan: registered in source; runtime verification required
- Registration: `runGithubDom`; fixture: `e2e-apps/github-issues`; checkpoints: `COMPUTED_CLASSES`; source: `e2e/ide/github-issues.runtime.issue289.test.ts:78`
- Routes: `/pages/issue-289/computed-class/index`

### e2e app: github-issues / issue-297-302 > issue #297: compiles complex call expressions

- Source: `e2e/ide/github-issues.runtime.issue297-302.test.ts:21`
- Plan: registered in source; runtime verification required
- Registration: `runGithubDom`; fixture: `e2e-apps/github-issues`; checkpoints: `CALL_EXPRESSIONS`; source: `e2e/ide/github-issues.runtime.issue297-302.test.ts:51`
- Routes: `/pages/issue-297/index`

### e2e app: github-issues / issue-297-302 > issue #297: setup method call variants remain stable across expression contexts

- Source: `e2e/ide/github-issues.runtime.issue297-302.test.ts:54`
- Plan: registered in source; runtime verification required
- Registration: `runGithubDom`; fixture: `e2e-apps/github-issues`; checkpoints: `SETUP_CALL_EXPRESSIONS`; source: `e2e/ide/github-issues.runtime.issue297-302.test.ts:88`
- Routes: `/pages/issue-297-setup-method-calls/index`

### e2e app: github-issues / issue-297-302 > issue #302: compiles v-for class bindings with active state updates

- Source: `e2e/ide/github-issues.runtime.issue297-302.test.ts:91`
- Plan: registered in source; runtime verification required
- Registration: `runGithubDom`; fixture: `e2e-apps/github-issues`; checkpoints: `LOOP_CLASSES`; source: `e2e/ide/github-issues.runtime.issue297-302.test.ts:106`
- Routes: `/pages/issue-302/index`

### github-issues runtime web runtime globals > issue #448: compiles the next batch of web runtime globals for DevTools

- Source: `e2e/ide/github-issues.runtime.web-runtime.test.ts:29`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `WEB_API_PLANS.issue448`; source: `e2e/ide/github-issues.runtime.web-runtime.test.ts:30`
- Operations: `check(initial)`

### github-issues runtime web runtime globals > issue #459: compiles directly imported web-apis polyfills for DevTools

- Source: `e2e/ide/github-issues.runtime.web-runtime.test.ts:55`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `WEB_API_PLANS.issue459`; source: `e2e/ide/github-issues.runtime.web-runtime.test.ts:56`
- Operations: `check(initial)`

### github-issues runtime web runtime globals > issue #804: keeps web runtime platform exports available to custom components

- Source: `e2e/ide/github-issues.runtime.web-runtime.test.ts:76`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `WEB_API_PLANS.issue804`; source: `e2e/ide/github-issues.runtime.web-runtime.test.ts:77`
- Operations: `check(initial)`

### github-issues runtime import.meta bindings > issue #431: renders supported native wxml import.meta bindings at runtime

- Source: `e2e/ide/github-issues.runtime.import-meta.test.ts:23`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: '/pages/issue-431/index', action: '检查原生模板和脚本的环境变量、模块路径及资源属性替换', nodes: [ { selector: '#issue431-env-label', text: 'issue-431 native wxml env replacement' }, { selector: '#issue431-image', attributes: { src: 'https:/`; source: `e2e/ide/github-issues.runtime.import-meta.test.ts:24`
- Routes: `/pages/issue-431/index`
- Operations: `callMethod(_runE2E)`, `check(initial)`

### github-issues runtime issue-466 > issue #466: keeps main-package tdesign Dialog.confirm callable through a user-facing page flow

- Source: `e2e/ide/github-issues.runtime.issue466.test.ts:181`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `dialogCheckpoints('/pages/issue-466/index', '#issue466-main-dialog', MAIN_DIALOG_STEPS, resolveRuntimeProviderName())`; source: `e2e/ide/github-issues.runtime.issue466.test.ts:182`
- Operations: `check(id)`

### github-issues runtime issue-466 > issue #466: keeps imported tdesign Dialog methods callable in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.issue466.test.ts:284`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `dialogCheckpoints('/subpackages/issue-466/index', '#issue466-dialog', steps, resolveRuntimeProviderName())`; source: `e2e/ide/github-issues.runtime.issue466.test.ts:286`
- Operations: `check(id)`

### github-issues runtime issue-466 > issue #466: keeps native aliased tdesign Dialog.confirm callable in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.issue466.test.ts:453`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `dialogCheckpoints('/subpackages/issue-466/native/index', '#issue466-native-dialog', NATIVE_DIALOG_STEPS, resolveRuntimeProviderName())`; source: `e2e/ide/github-issues.runtime.issue466.test.ts:454`
- Operations: `check(id)`

### e2e app: github-issues / issues #553 and #555 > issue #553: keeps component v-model arguments separate in DevTools

- Source: `e2e/ide/github-issues.runtime.issue553-555.test.ts:53`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE553`; source: `e2e/ide/github-issues.runtime.issue553-555.test.ts:54`
- Operations: `check(initial)`, `tap(<missing>)`, `check(abc)`, `check(model)`

### e2e app: github-issues / issues #553 and #555 > issue #555: renders and toggles v-if named slot content in DevTools

- Source: `e2e/ide/github-issues.runtime.issue553-555.test.ts:122`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE555`; source: `e2e/ide/github-issues.runtime.issue553-555.test.ts:123`
- Operations: `check(initial)`, `check(hidden)`, `check(restored)`

### e2e app: github-issues / issue #554 > renders default slot content from components with v-for in DevTools

- Source: `e2e/ide/github-issues.runtime.issue554.test.ts:34`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: ISSUE_554_ROUTE, action: '检查循环组件投影的图片节点和资源路径', nodes: [{ selector: '.issue554-image', attributes: { src: ISSUE_554_EXPECTED_IMAGE, mode: 'aspectFit' }, ...(resolveRuntimeProviderName() === 'devtools' ? { visible: tr`; source: `e2e/ide/github-issues.runtime.issue554.test.ts:35`
- Operations: `check(initial)`

### e2e app: github-issues / issue #564 > renders native component default content without nested scoped slot components in DevTools

- Source: `e2e/ide/github-issues.runtime.issue564.test.ts:53`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: ISSUE_564_ROUTE, action: '检查两个原生 tabbar item 接收的默认插槽文本', nodes: [ { selector: '#issue-564-home', text: 'issue-564-home' }, { selector: '#issue-564-user', text: 'issue-564-user' }, { selector: '.issue564-slot-label',`; source: `e2e/ide/github-issues.runtime.issue564.test.ts:54`
- Operations: `check(initial)`

### e2e app: github-issues / issue #581 > renders reactive array pushes after a sibling setup ref flushes first in DevTools

- Source: `e2e/ide/github-issues.runtime.issue581.test.ts:102`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[arrayFlushCheckpoint('initial', ['init', '123', '456'])]`; source: `e2e/ide/github-issues.runtime.issue581.test.ts:103`
- Operations: `check(initial)`

### e2e app: github-issues / issue #581 > keeps repeated setup object requeues visible across multiple DevTools flushes

- Source: `e2e/ide/github-issues.runtime.issue581.test.ts:131`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[ arrayFlushCheckpoint('initial', ['init', '123', '456']), arrayFlushCheckpoint('second', ['init', '123', '456', '789', '999']), arrayFlushCheckpoint('third', ['init', '123', '456', '789', '999', 'abc']), ]`; source: `e2e/ide/github-issues.runtime.issue581.test.ts:132`
- Operations: `check(initial)`, `check(second)`, `check(third)`

### e2e app: github-issues / issue #627 > checks which host attributes are available as native and Vue SFC component props in DevTools

- Source: `e2e/ide/github-issues.runtime.issue627.test.ts:35`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `RESERVED_PROPS_CHECKPOINTS`; source: `e2e/ide/github-issues.runtime.issue627.test.ts:36`
- Operations: `callMethod(refreshMatrix)`, `check(initial)`

### e2e app: github-issues / issue #642 > keeps vueSlots populated after many dynamic object props on the same component

- Source: `e2e/ide/github-issues.runtime.issue642.test.ts:94`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE642`; source: `e2e/ide/github-issues.runtime.issue642.test.ts:95`
- Operations: `check(initial)`, `tap(<missing>)`, `check(updated)`

### e2e app: github-issues / issue #705 > keeps route state and hook origins synchronized across router and native tab navigation

- Source: `e2e/ide/github-issues.runtime.issue705.test.ts:164`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE705_TABS`; source: `e2e/ide/github-issues.runtime.issue705.test.ts:165`
- Routes: `pages/issue-705-tab/index`
- Operations: `check(initial)`, `check(pushed)`, `check(reloaded)`, `check(tab)`, `check(tab-pushed)`

### e2e app: github-issues / issue #705 > restores route state after every back path and allows pushing the same target again

- Source: `e2e/ide/github-issues.runtime.issue705.test.ts:244`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE705_BACK`; source: `e2e/ide/github-issues.runtime.issue705.test.ts:245`
- Operations: `check(router:initial)`, `check(router:pushed)`, `callMethodWithOptions(_runE2E)`, `check(router:returned)`, `check(router:repushed)`, `check(native:initial)`, `check(native:pushed)`, `check(native:returned)`, `check(native:repushed)`, `check(system:initial)`, `check(system:pushed)`, `check(system:returned)`, `check(system:repushed)`

### e2e app: github-issues / issue #706 > uses the app-service Page protocol when the DevTools page-frame channel is unavailable

- Source: `e2e/ide/github-issues.runtime.issue706.test.ts:22`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `['ready', 'updated', 'method'].map(status => ({ id: status, route: '/pages/issue-706/index', action: status === 'ready' ? '检查首屏 RPC 提示和状态' : \`通过 ${status === 'updated' ? 'setData' : 'page method'} 更新并检查可见状态\`, nodes: [ { selector: '.hello', `; source: `e2e/ide/github-issues.runtime.issue706.test.ts:24`
- Routes: `/pages/issue-706/index`
- Operations: `callMethodWithOptions(_runE2E)`, `check(ready)`, `check(updated)`, `callMethodWithOptions(_setProbeStatus)`, `check(method)`

### e2e app: github-issues / issue #829 > preserves function props for direct and nested scoped-slot components

- Source: `e2e/ide/github-issues.runtime.issue829.test.ts:39`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `['direct', 'nested'].map((kind) => { const scope = [ ...(kind === 'nested' ? ['#issue829-card', { has: '#issue-829-nested-query' }] : []), \`#issue-829-${kind}-query\`, { has: \`.issue829-${kind}-result\` }, ] return { id: kind, route: ISSUE_RO`; source: `e2e/ide/github-issues.runtime.issue829.test.ts:40`
- Operations: `check(direct)`, `check(nested)`

### e2e app: github-issues / issue #930 > preserves native nested CSS fallbacks through dynamic overrides and restoration

- Source: `e2e/ide/github-issues.runtime.issue930.test.ts:56`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `stages.map(stage => ({ id: \`nested-vars:${stage}\`, route: NESTED_VARS_ROUTE, action: stage === 'initial' ? '检查两层行高、三层圆角和渐变 fallback' : stage === 'updated' ? '点击覆盖变量后检查渲染与实际样式' : '再次点击恢复默认 fallback', nodes: [ { selector: '#vars-root', attrib`; source: `e2e/ide/github-issues.runtime.issue930.test.ts:59`
- Operations: `check(nested-vars:${stage})`, `tap(<missing>)`

### e2e app: github-issues / issue #930 > keeps every compiler-owned binding live on initial and subsequent setData

- Source: `e2e/ide/github-issues.runtime.issue930.test.ts:117`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `['initial', 'updated'].map(state => ({ id: state, route: ISSUE_ROUTE, action: state === 'initial' ? '检查首屏编译器拥有的绑定' : '更新成员表达式、model、template 和 CSS 变量后检查渲染', nodes: [ { selector: '#issue-930-member', text: \`member-${state}\` }, { selector: '#`; source: `e2e/ide/github-issues.runtime.issue930.test.ts:118`
- Operations: `check(initial)`, `callMethod(_runE2E)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #309: triggers onLoad without requiring onPullDownRefresh hook

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:317`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue309`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:318`
- Operations: `check(initial)`

### e2e app: github-issues / lifecycle > issue #309: triggers onLoad with created setupLifecycle and no pull-down hook

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:338`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue309Created`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:339`
- Operations: `check(initial)`

### e2e app: github-issues / lifecycle > issue #312: updates computed object bindings after switching back to initial reference

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:359`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue312`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:360`
- Operations: `check(initial)`, `check(incremented)`, `check(restored)`

### e2e app: github-issues / lifecycle > issue #316: triggers kebab-case component event bindings at runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:416`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue316`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:417`
- Operations: `check(initial)`, `callMethod(_runE2E)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #318: keeps template call-expression rendering stable with auto setData.pick

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:454`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue318`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:455`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #320: supports runtime addRoute alias and redirect navigation

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:481`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue320`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:482`
- Operations: `check(initial)`, `check(redirected)`

### e2e app: github-issues / lifecycle > issue #380: keeps custom tab bar out of default layout at runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:518`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue380`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:519`
- Operations: `check(initial)`

### e2e app: github-issues / lifecycle > issue #385: does not attach the page component twice after setPageLayout("default")

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:535`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue385`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:536`
- Operations: `callMethod(_runE2E)`, `check(initial)`

### e2e app: github-issues / lifecycle > issue #398: keeps layout child components mounted through the shared wevu runtime path

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:559`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue398`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:560`
- Operations: `callMethod(_runE2E)`, `check(initial)`

### e2e app: github-issues / lifecycle > issue #404: exposes page.onPageScroll on the runtime instance and receives page scroll updates

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:596`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue404`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:597`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #418/#419: keeps third-party component template refs available in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:631`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue418419`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:632`
- Operations: `check(initial)`

### e2e app: github-issues / lifecycle > issue #446: keeps template refs and shortBind props available in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:665`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue446`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:666`
- Operations: `callMethod(_runE2E)`, `check(initial)`

### e2e app: github-issues / lifecycle > issue #479: triggers indirect pull-down hook in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:704`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue479Pull`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:705`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #479: triggers indirect reach-bottom hook through Component page method bridge

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:739`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue479Bottom`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:740`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #695: triggers direct pull-down hook through Component page method bridge

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:770`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue695`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:771`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > experiment: block nodes can provide named and default slot content in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:805`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.blockSlot`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:806`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #494: plain template v-slot content unwraps to child slot attrs or block wrappers in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:844`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue494`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:845`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #500: missing inject default continues later setup code in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:885`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue500`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:886`
- Operations: `check(initial)`

### e2e app: github-issues / lifecycle > experiment: flex parent keeps projected multi-node slot groups visible in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:917`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `slotFlexCheckpoint(resolveRuntimeProviderName())`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:918`
- Operations: `check(initial)`

### e2e app: github-issues / lifecycle > experiment: native self-closing and paired slot tags render equivalently in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:955`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.slotTag`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:956`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / lifecycle > issue #373: keeps shared store computed reactive after reLaunch tears down the first page

- Source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:995`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GITHUB_LIFECYCLE_PLANS.issue373`; source: `e2e/ide/github-issues.runtime.lifecycle.test.ts:996`
- Operations: `callMethod(_runE2E)`, `check(initial)`, `check(relaunch)`, `check(incremented)`

### github-issues runtime miniprogram-computed > keeps build-npm cjs package miniprogram-computed working in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.miniprogram-computed.test.ts:119`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[ { id: 'initial', route: ROUTE, action: '首屏检查 computed sum 和 summary', nodes: [ { selector: '#computed-sum', scope: ['#issue466-computed-probe'], text: 'sum = 3' }, { selector: '#computed-summary', scope: ['#issue466-computed-probe'], text`; source: `e2e/ide/github-issues.runtime.miniprogram-computed.test.ts:120`
- Operations: `check(initial)`, `check(updated)`, `check(reset)`, `check(alertOpened)`, `check(alertConfirmed)`, `check(confirmOpened)`, `check(cancelled)`, `check(actionOpened)`, `check(selected)`, `check(closePrepared)`, `check(closed)`

### e2e app: github-issues / props > issue #322: keeps static class and hidden v-show state on first render before errors object exists

- Source: `e2e/ide/github-issues.runtime.props.test.ts:60`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue322`; source: `e2e/ide/github-issues.runtime.props.test.ts:61`
- Operations: `check(initial)`, `check(error)`, `check(cleared)`

### e2e app: github-issues / props > issue #300: renders destructured boolean props in runtime call-expression bindings

- Source: `e2e/ide/github-issues.runtime.props.test.ts:107`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue300`; source: `e2e/ide/github-issues.runtime.props.test.ts:108`
- Operations: `check(initial)`, `check(toggled)`

### e2e app: github-issues / props > issue #328: keeps setup ref string props out of null/default fallback on first paint

- Source: `e2e/ide/github-issues.runtime.props.test.ts:154`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue328`; source: `e2e/ide/github-issues.runtime.props.test.ts:155`
- Operations: `check(initial)`, `check(updated)`

### e2e app: github-issues / props > issue #955: preserves union values and nullable defaults without native prop coercion

- Source: `e2e/ide/github-issues.runtime.props.test.ts:186`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue955`; source: `e2e/ide/github-issues.runtime.props.test.ts:187`
- Operations: `check(initial)`, `check(number)`, `check(null)`, `check(undefined)`, `check(string)`

### e2e app: github-issues / props > issue #597: keeps v-if and v-else named slot branches intact in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.props.test.ts:286`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue597`; source: `e2e/ide/github-issues.runtime.props.test.ts:287`
- Operations: `check(initial)`, `check(else)`

### e2e app: github-issues / props > issue #613: compares forwarded slot outlets with view and native block wrappers in DevTools runtime

- Source: `e2e/ide/github-issues.runtime.props.test.ts:316`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue613`; source: `e2e/ide/github-issues.runtime.props.test.ts:317`
- Operations: `check(initial)`

### e2e app: github-issues / props > issue #599: renders props named data in computed style bindings

- Source: `e2e/ide/github-issues.runtime.props.test.ts:374`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue599`; source: `e2e/ide/github-issues.runtime.props.test.ts:375`
- Operations: `check(initial)`

### e2e app: github-issues / props > issue #600: renders renamed defineProps destructure aliases in template and computed bindings

- Source: `e2e/ide/github-issues.runtime.props.test.ts:405`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `propsCheckpoints(resolveRuntimeProviderName()).issue600`; source: `e2e/ide/github-issues.runtime.props.test.ts:406`
- Operations: `check(alias)`, `check(default)`

### e2e app: github-issues / app shell runtime > issue #563: renders app.vue shell, page layout, and page content in real DevTools

- Source: `e2e/ide/github-issues.runtime.app-shell.test.ts:53`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `SHELL_CHECKPOINTS.default`; source: `e2e/ide/github-issues.runtime.app-shell.test.ts:54`
- Operations: `check(initial)`

### e2e app: github-issues / app shell runtime > issue #448/#563: keeps web runtime URL parsing and app shell when page layout is disabled

- Source: `e2e/ide/github-issues.runtime.app-shell.test.ts:84`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `SHELL_CHECKPOINTS.disabled`; source: `e2e/ide/github-issues.runtime.app-shell.test.ts:85`
- Operations: `check(initial)`

### e2e app: github-issues / slot fallback > issue #520: renders slots passed to resolver-imported wevu components

- Source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:35`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `fallbackPlans(resolveRuntimeProviderName()).issue520`; source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:36`
- Operations: `callMethod(_runE2E)`, `check(initial)`

### e2e app: github-issues / slot fallback > issue #521: keeps scoped slot flex children on the same row in DevTools

- Source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:63`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `fallbackPlans(resolveRuntimeProviderName()).issue521`; source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:64`
- Operations: `check(initial)`

### e2e app: github-issues / slot fallback > issue #528: renders slot fallback only when parent slot content is absent

- Source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:93`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `fallbackPlans(resolveRuntimeProviderName()).issue528`; source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:94`
- Operations: `callMethod(_runE2E)`, `check(initial)`

### e2e app: github-issues / slot fallback > issue #530: renders default slot fallback with short slot presence metadata

- Source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:125`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `fallbackPlans(resolveRuntimeProviderName()).issue530`; source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:126`
- Operations: `check(initial)`

### e2e app: github-issues / slot fallback > scoped slot outlet fallback: renders native named slot projection in DevTools

- Source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:149`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `fallbackPlans(resolveRuntimeProviderName()).outlet`; source: `e2e/ide/github-issues.runtime.slot-fallback.test.ts:150`
- Operations: `check(initial)`

## ide/github-issues.runtime.component-instance-apis.test.ts

### github issues: native component instance APIs > keeps native relation lifecycle order and component selector scopes across removal and restoration

- Source: `e2e/ide/github-issues.runtime.component-instance-apis.test.ts:25`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[ { id: 'baseline', route: BASELINE_ROUTE, action: '离开上轮组件后显式清空事件，检查独立准备页', nodes: [{ selector: '#baseline-title', text: '准备组件关系验收' }] }, ...stages.map(stage => ({ id: stage.id, route: ROUTE, action: stage.action, nodes: [ { selector: '#rel`; source: `e2e/ide/github-issues.runtime.component-instance-apis.test.ts:31`
- Operations: `act(baseline)`, `check(baseline)`, `act(initial)`, `act(stage.id)`, `callMethod(snapshot)`, `check(stage.id)`

## ide/github-issues.runtime.issue448-formdata-upload.test.ts

### github-issues runtime issue #448 FormData upload > uploads wx.downloadFile data as Blob, File, and Request FormData bodies in real DevTools

- Source: `e2e/ide/github-issues.runtime.issue448-formdata-upload.test.ts:94`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `UPLOAD_CHECKPOINTS`; source: `e2e/ide/github-issues.runtime.issue448-formdata-upload.test.ts:95`
- Operations: `check(initial)`, `check(checkpoint.id)`

## ide/github-issues.runtime.issue547.test.ts

### e2e app: github-issues / issue #547 > renders nested augmented default slot content in DevTools

- Source: `e2e/ide/github-issues.runtime.issue547.test.ts:28`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: '/pages/issue-547/index', action: '检查两层 augmented 默认插槽内的最终组件文本', nodes: [ { selector: '.issue547-group__title', text: 'issue-547 nested slot group', scope: ['#issue547-group'] }, { selector: '.issue547-image', text:`; source: `e2e/ide/github-issues.runtime.issue547.test.ts:29`
- Routes: `/pages/issue-547/index`
- Operations: `check(initial)`

## ide/github-issues.runtime.issue558.test.ts

### e2e app: github-issues / issue #558 > renders owner-proxy bindings across augmented slot variants in DevTools

- Source: `e2e/ide/github-issues.runtime.issue558.test.ts:79`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `AUGMENTED_SLOT_CHECKPOINTS`; source: `e2e/ide/github-issues.runtime.issue558.test.ts:80`
- Operations: `callMethod(_runE2E)`, `check(checkpoint.id)`

## ide/github-issues.runtime.issue615.test.ts

### e2e app: github-issues / issue #615 > renders scoped slot v-for owner list in DevTools without owner initialization errors

- Source: `e2e/ide/github-issues.runtime.issue615.test.ts:40`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: '/pages/issue-615/index', action: '检查 scoped-slot v-for 三个实际标签及数量', nodes: [ ...['issue-615-tab-1', 'issue-615-tab-2', 'issue-615-tab-3'].map(label => ({ selector: \`#${label}\`, text: label, scope: [ '#issue615-tabba`; source: `e2e/ide/github-issues.runtime.issue615.test.ts:41`
- Routes: `/pages/issue-615/index`
- Operations: `check(initial)`

## ide/github-issues.runtime.issue621.test.ts

### e2e app: github-issues / issue #621 > keeps inline assignment events writable for setup refs in DevTools

- Source: `e2e/ide/github-issues.runtime.issue621.test.ts:48`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `INLINE_ASSIGNMENT_CHECKPOINTS`; source: `e2e/ide/github-issues.runtime.issue621.test.ts:49`
- Operations: `tap(<missing>)`, `check(step.id)`

## ide/github-issues.runtime.issue642-bug7-default.test.ts

### e2e app: github-issues / issue #642 bug-7 default mode > renders bug-7 scoped and default slots in normal mode without runtime loops

- Source: `e2e/ide/github-issues.runtime.issue642-bug7-default.test.ts:20`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE642_BUG7`; source: `e2e/ide/github-issues.runtime.issue642-bug7-default.test.ts:21`

## ide/github-issues.runtime.issue642-bug7-performance.test.ts

### e2e app: github-issues / issue #642 bug-7 performance mode > renders bug-7 scoped and default slots in performance mode without runtime loops

- Source: `e2e/ide/github-issues.runtime.issue642-bug7-performance.test.ts:20`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE642_BUG7`; source: `e2e/ide/github-issues.runtime.issue642-bug7-performance.test.ts:21`

## ide/github-issues.runtime.issue642-bug8.test.ts

### e2e app: github-issues / issue #642 bug-8 > keeps scoped slot owner id when scoped slot component is nested through another component

- Source: `e2e/ide/github-issues.runtime.issue642-bug8.test.ts:91`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `ISSUE642_BUG8`; source: `e2e/ide/github-issues.runtime.issue642-bug8.test.ts:92`
- Operations: `check(initial)`

## ide/github-issues.runtime.issue779.test.ts

### e2e app: github-issues / issue #779 > renders the pre-transformed external SFC stylesheet instead of the original disk source

- Source: `e2e/ide/github-issues.runtime.issue779.test.ts:46`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'pre-transformed-style', route: '/pages/issue-779/index', action: '检查 SFC 外链样式经过 pre 插件和 Tailwind 编译后的实际文本与计算颜色', nodes: [{ selector: '#issue779-page', count: 1, text: 'issue 779', styles: { 'color': 'rgb(1, 2, 3)', 'padding-top': '1`; source: `e2e/ide/github-issues.runtime.issue779.test.ts:47`
- Routes: `/pages/issue-779/index`
- Operations: `check(pre-transformed-style)`

## ide/github-issues.runtime.issue826.test.ts

### e2e app: github-issues / issue #826 > executes preserved single, shared and barrel modules across page relaunches

- Source: `e2e/ide/github-issues.runtime.issue826.test.ts:35`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'index', route: '/pages/issue-826/index', action: '首屏执行保留的 single、shared 和 barrel 模块', nodes: [{ selector: '#issue826-page', text: INDEX_VALUE }], }, { id: 'second', route: '/pages/issue-826/second', action: 'reLaunch 后检查共享模块与 barrel`; source: `e2e/ide/github-issues.runtime.issue826.test.ts:36`
- Routes: `/pages/issue-826/index`, `/pages/issue-826/second`
- Operations: `check(index)`, `check(second)`

## ide/github-issues.runtime.issue852.test.ts

### e2e app: github-issues / issue #852 > renders numeric separator bindings in real WeChat DevTools

- Source: `e2e/ide/github-issues.runtime.issue852.test.ts:39`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: ISSUE_ROUTE, action: '检查组件属性和不同进制数字分隔符表达式的实际文本', nodes: [ { selector: '#issue-852-count', scope: ['#issue-852-count-component'], text: 'Count: 1000000' }, { selector: '#issue852-decimal', text: 'decimal: 10000000000`; source: `e2e/ide/github-issues.runtime.issue852.test.ts:40`
- Operations: `check(initial)`

## ide/github-issues.runtime.issue868.test.ts

### e2e app: github-issues / issue #868 > renders projected keys and restores source identity in real runtime

- Source: `e2e/ide/github-issues.runtime.issue868.test.ts:38`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `IDENTITY_CHECKPOINTS`; source: `e2e/ide/github-issues.runtime.issue868.test.ts:39`
- Operations: `check(initial)`, `callMethodWithOptions(_runE2E)`, `check(updated)`

## ide/github-issues.runtime.issue911.test.ts

### e2e app: github-issues / issue #911 > waits for the initial async beforeEach guard before mounting

- Source: `e2e/ide/github-issues.runtime.issue911.test.ts:81`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GUARD_PLANS.default`; source: `e2e/ide/github-issues.runtime.issue911.test.ts:82`
- Operations: `callMethod(resetTrace)`, `check(baseline)`, `callMethodWithOptions(_runE2E)`, `check(mounted)`

### e2e app: github-issues / issue #911 > waits for an async guard before resolving a redirect and mounting the initial page

- Source: `e2e/ide/github-issues.runtime.issue911.test.ts:99`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GUARD_PLANS.redirect`; source: `e2e/ide/github-issues.runtime.issue911.test.ts:100`
- Routes: `/pages/issue-911/index?mode=redirect`
- Operations: `callMethod(resetTrace)`, `check(baseline)`, `reLaunch(/pages/issue-911/index?mode=redirect)`, `check(mounted)`

### e2e app: github-issues / issue #911 > aborts after an async guard without mounting the target page

- Source: `e2e/ide/github-issues.runtime.issue911.test.ts:121`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GUARD_PLANS.abort`; source: `e2e/ide/github-issues.runtime.issue911.test.ts:122`
- Routes: `/pages/issue-911/index?mode=abort`
- Operations: `callMethod(resetTrace)`, `check(baseline)`, `reLaunch(/pages/issue-911/index?mode=abort)`, `check(blocked)`, `check(result)`

### e2e app: github-issues / issue #911 > does not run the issue guard for a subsequent non-target navigation

- Source: `e2e/ide/github-issues.runtime.issue911.test.ts:138`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GUARD_PLANS.subsequent`; source: `e2e/ide/github-issues.runtime.issue911.test.ts:139`
- Operations: `callMethod(resetTrace)`, `check(baseline)`, `check(mounted)`, `check(other)`

### e2e app: github-issues / issue #911 > mounts after the default timeout when an initial guard never settles

- Source: `e2e/ide/github-issues.runtime.issue911.test.ts:158`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GUARD_PLANS.never`; source: `e2e/ide/github-issues.runtime.issue911.test.ts:159`
- Routes: `/pages/issue-911/index?mode=never`
- Operations: `callMethod(resetTrace)`, `check(baseline)`, `reLaunch(/pages/issue-911/index?mode=never)`, `callMethodWithOptions(_runE2E)`, `check(mounted)`

### e2e app: github-issues / issue #911 > settles a rejected initial guard without leaving an unhandled promise gate

- Source: `e2e/ide/github-issues.runtime.issue911.test.ts:173`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GUARD_PLANS.reject`; source: `e2e/ide/github-issues.runtime.issue911.test.ts:174`
- Routes: `/pages/issue-911/index?mode=reject`
- Operations: `callMethod(resetTrace)`, `check(baseline)`, `reLaunch(/pages/issue-911/index?mode=reject)`, `check(blocked)`, `check(result)`

### e2e app: github-issues / issue #911 > cancels a late guard when the page is replaced quickly

- Source: `e2e/ide/github-issues.runtime.issue911.test.ts:188`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `GUARD_PLANS.late`; source: `e2e/ide/github-issues.runtime.issue911.test.ts:189`
- Routes: `/pages/issue-911/index?mode=late`, `/pages/issue-550/index`
- Operations: `callMethod(resetTrace)`, `check(baseline)`, `reLaunch(/pages/issue-911/index?mode=late)`, `reLaunch(/pages/issue-550/index)`, `check(replaced)`, `check(settled)`, `check(result)`

## ide/github-issues.runtime.issue941.test.ts

### e2e app: github-issues / issue #941 > keeps every wx direct-return API out of the Promise bridge

- Source: `e2e/ide/github-issues.runtime.issue941.test.ts:33`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: ISSUE_941_ROUTE, action: '检查尚未执行 adapter 的首屏', nodes: [ { selector: '#issue941-title', text: 'issue-941 direct-return adapter' }, { selector: '#issue941-cache-options', text: 'cache options: pending' }, { selector: `; source: `e2e/ide/github-issues.runtime.issue941.test.ts:34`
- Operations: `check(initial)`, `callMethodWithOptions(_runE2E)`, `check(executed)`

## ide/github-issues.runtime.require-async.test.ts

### e2e app: github-issues / require async subpackage modules > loads subpackage modules through callback, Promise, and native import APIs

- Source: `e2e/ide/github-issues.runtime.require-async.test.ts:45`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[ ['initial', 'ready', 'none', 'none'], ['callback', 'loaded', 'callback', 'require-async:callback'], ['promise', 'loaded', 'promise', 'require-async:promise'], ['native', 'loaded', 'native', 'require-async:native-default:require-async:nati`; source: `e2e/ide/github-issues.runtime.require-async.test.ts:46`
- Operations: `check(initial)`, `callMethodWithOptions(_runE2E)`, `check(callback)`, `check(promise)`, `check(native)`

## ide/github-issues.runtime.slot-fallback-compiler-off.test.ts

### e2e app: github-issues / slot fallback compiler off > renders plain slot fallback independently from scopedSlotsCompiler

- Source: `e2e/ide/github-issues.runtime.slot-fallback-compiler-off.test.ts:68`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `fallbackPlans(resolveRuntimeProviderName()).compilerOff`; source: `e2e/ide/github-issues.runtime.slot-fallback-compiler-off.test.ts:69`
- Operations: `check(initial)`

## ide/github-issues.runtime.subpackage-item.test.ts

### e2e app: github-issues / item subpackage > issue #317: loads duplicated shared chunks with localized runtime

- Source: `e2e/ide/github-issues.runtime.subpackage-item.test.ts:25`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: '/subpackages/item/index', action: '检查 item 分包的共享 runtime 实例和 npm 模块结果', nodes: [ { selector: '.issue317-message', text: 'ITEM:ready:instance' }, { selector: '.issue317-npm-marker', text: 'issue317ItemNpmReady' }, ]`; source: `e2e/ide/github-issues.runtime.subpackage-item.test.ts:26`
- Routes: `/subpackages/item/index`
- Operations: `check(initial)`

### e2e app: github-issues / item subpackage > issue #340: loads cross-subpackage source imports in item/login-required

- Source: `e2e/ide/github-issues.runtime.subpackage-item.test.ts:51`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: '/subpackages/item/login-required/index', action: '检查 item 页面跨分包导入的实际执行结果', nodes: [ { selector: '.issue340-message', text: 'item-login-required:issue-340:shared' }, ], }]`; source: `e2e/ide/github-issues.runtime.subpackage-item.test.ts:52`
- Routes: `/subpackages/item/login-required/index`
- Operations: `check(initial)`

## ide/github-issues.runtime.subpackage-user.test.ts

### e2e app: github-issues / user subpackage > issue #317: loads duplicated shared chunks with localized runtime

- Source: `e2e/ide/github-issues.runtime.subpackage-user.test.ts:25`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: '/subpackages/user/index', action: '检查 user 分包的共享 runtime 实例和 npm 模块结果', nodes: [ { selector: '.issue317-message', text: 'USER:ready:instance' }, { selector: '.issue317-npm-marker', text: 'Issue317 user npm ready' }`; source: `e2e/ide/github-issues.runtime.subpackage-user.test.ts:26`
- Routes: `/subpackages/user/index`
- Operations: `check(initial)`

### e2e app: github-issues / user subpackage > issue #340: loads cross-subpackage source imports in user/register/form

- Source: `e2e/ide/github-issues.runtime.subpackage-user.test.ts:51`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/github-issues`; checkpoints: `[{ id: 'initial', route: '/subpackages/user/register/form', action: '检查 user 页面跨分包导入的实际执行结果', nodes: [ { selector: '.issue340-message', text: 'user-register-form:issue-340:shared' }, ], }]`; source: `e2e/ide/github-issues.runtime.subpackage-user.test.ts:52`
- Routes: `/subpackages/user/register/form`
- Operations: `check(initial)`

## ide/hmr-auto-classic.runtime.test.ts

### automatic classic HMR in real WeChat DevTools > uses direct output and reloads the page instead of preserving its state

- Source: `e2e/ide/hmr-auto-classic.runtime.test.ts:144`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/stateful-hmr`; checkpoints: `[ ['initial', 'STATEFUL-NATIVE-BASE', 0, ''], ['prepared', 'STATEFUL-NATIVE-BASE', 1, 'classic-held-input'], ['reloaded', 'STATEFUL-NATIVE-PATCHED', 0, ''], ['updated', 'STATEFUL-NATIVE-PATCHED', 2, ''], ].map(([id, marker, count, input]) =`; source: `e2e/ide/hmr-auto-classic.runtime.test.ts:145`
- Routes: `/pages/native/index`, `/pages/native/index?source=classic-auto-e2e`
- Operations: `reLaunch(/pages/native/index?source=classic-auto-e2e)`, `check(initial)`, `check(prepared)`, `check(reloaded)`, `check(updated)`

## ide/index.test.ts

### e2e baseline app > opens index page and keeps build output stable

- Source: `e2e/ide/index.test.ts:188`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/base`; checkpoints: `[ { id: 'initial', route: INDEX_ROUTE, action: '冷启动首页，检查实际结果和输入数据文本', nodes: [ { selector: '#base-greeting', text: 'Hello' }, { selector: '#base-status', text: 'Status: ready' }, { selector: '#base-detail', text: 'Detail: rendered' }, { sel`; source: `e2e/ide/index.test.ts:189`
- Operations: `check(initial)`, `tap(<missing>)`, `check(tapped)`

## ide/issue-340-hoist.runtime.test.ts

### e2e app: issue-340-hoist runtime > reLaunches both subpackage pages with hoisted shared imports intact

- Source: `e2e/ide/issue-340-hoist.runtime.test.ts:264`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/issue-340-hoist`; checkpoints: `[ { id: 'item', route: '/subpackages/item/login-required/index', action: '打开商品分包，检查标题和共享模块生成的文本', nodes: [ { selector: '.issue340-title', text: 'issue-340 hoist item login required' }, { selector: '.issue340-message', text: 'item-login-requ`; source: `e2e/ide/issue-340-hoist.runtime.test.ts:265`
- Routes: `/subpackages/item/login-required/index`, `/subpackages/user/register/form`
- Operations: `check(item)`, `check(user)`

## ide/layout-power-demo-message.runtime.test.ts

### layout-power-demo message feedback in real WeChat DevTools > keeps repeated message taps stable after layout switches

- Source: `e2e/ide/layout-power-demo-message.runtime.test.ts:17`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `LAYOUT_POWER_FIXTURE`; checkpoints: `[ layoutStateCheckpoint('initial', '启动后检查默认布局、页面内容和交互计数', 'default', 1), ...feedbackRoundCheckpoints('repeat', 5), ]`; source: `e2e/ide/layout-power-demo-message.runtime.test.ts:18`
- Operations: `reLaunch(INDEX_ROUTE)`, `check(initial)`, `callMethod(runE2E)`

## ide/layout-power-demo.runtime-vendor-hmr.test.ts

### layout-power-demo runtime vendor HMR in real WeChat DevTools > keeps active runtime vendor chunks available after page script HMR

- Source: `e2e/ide/layout-power-demo.runtime-vendor-hmr.test.ts:55`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `LAYOUT_POWER_FIXTURE`; checkpoints: `[ layoutStateCheckpoint('initial', '启动后检查默认界面', 'default', 1), ...feedbackRoundCheckpoints('before-script', 1), layoutStateCheckpoint('script-preserved', '脚本更新完成后保持海报布局及五次交互状态', 'poster', 5), layoutStateCheckpoint('script-command', '热更新后原页面`; source: `e2e/ide/layout-power-demo.runtime-vendor-hmr.test.ts:56`
- Operations: `reLaunch(INDEX_ROUTE)`, `check(initial)`, `callMethod(runE2E)`, `check(script-preserved)`, `check(script-command)`, `check(script-new-title)`, `check(new-page)`, `check(template-updated)`, `check(style-before)`, `check(style-updated)`

## ide/lifecycle-compare.test.ts

### lifecycle compare (e2e) > compares page lifecycles (native vs wevu ts/vue)

- Source: `e2e/ide/lifecycle-compare.test.ts:460`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `LIFECYCLE_FIXTURE`; checkpoints: `PAGE_VARIANTS.flatMap(lifecycleCheckpoints)`; source: `e2e/ide/lifecycle-compare.test.ts:461`
- Routes: `/pages/blank/index`, `/pages/native/index`, `/pages/wevu-ts/index`, `/pages/wevu-vue/index`
- Operations: `reLaunch(route)`, `reLaunch(/pages/blank/index)`, `switchTab(fallbackTab)`, `switchTab(/pages/native/index)`, `check(native:initial)`, `callMethod(resetLifecycleLogs)`, `check(native:${stage})`, `callMethod(finalizeLifecycleLogs)`, `check(native:finalized)`, `switchTab(/pages/wevu-ts/index)`, `check(wevu-ts:initial)`, `check(wevu-ts:${stage})`, `check(wevu-ts:finalized)`, `switchTab(/pages/wevu-vue/index)`, `check(wevu-vue:initial)`, `check(wevu-vue:${stage})`, `check(wevu-vue:finalized)`

### lifecycle compare (e2e) > compares component lifecycles (native vs wevu ts/vue)

- Source: `e2e/ide/lifecycle-compare.test.ts:503`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `LIFECYCLE_FIXTURE`; checkpoints: `lifecycleCheckpoints('components')`; source: `e2e/ide/lifecycle-compare.test.ts:504`
- Routes: `/pages/blank/index`, `/pages/components/index`
- Operations: `reLaunch(route)`, `reLaunch(/pages/blank/index)`, `switchTab(fallbackTab)`, `switchTab(/pages/components/index)`, `check(components:initial)`, `check(components:${stage})`, `callMethod(finalizeLifecycleLogs)`, `check(components:finalized)`

### lifecycle compare (e2e) > verifies bind event alias behavior for native view/native component/wevu sfc component

- Source: `e2e/ide/lifecycle-compare.test.ts:533`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `LIFECYCLE_FIXTURE`; checkpoints: `Array.from({ length: 13 }, (_, index) => aliasCheckpoint(index))`; source: `e2e/ide/lifecycle-compare.test.ts:534`
- Routes: `/pages/blank/index`, `/pages/components/index`
- Operations: `reLaunch(route)`, `reLaunch(/pages/blank/index)`, `switchTab(fallbackTab)`, `switchTab(/pages/components/index)`, `callMethod(resetEventBindingStats)`, `check(alias:0)`, `callMethod(triggerViewEventBinding)`, `check(alias:${++operation})`, `callMethod(triggerComponentProbe)`, `callMethod(getEventBindingStats)`

### lifecycle compare (e2e) > verifies triggerEvent hyphen/underscore event names with bind and bind: forms

- Source: `e2e/ide/lifecycle-compare.test.ts:606`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `LIFECYCLE_FIXTURE`; checkpoints: `Array.from({ length: 13 }, (_, index) => namedEventCheckpoint(index))`; source: `e2e/ide/lifecycle-compare.test.ts:607`
- Routes: `/pages/blank/index`, `/pages/components/index`
- Operations: `reLaunch(route)`, `reLaunch(/pages/blank/index)`, `switchTab(fallbackTab)`, `switchTab(/pages/components/index)`, `callMethod(resetNamedEventBindingStats)`, `check(named:0)`, `callMethod(triggerNamedComponentProbe)`, `check(named:${++operation})`, `callMethod(getNamedEventBindingStats)`

## ide/mcp-runtime-tools.runtime.test.ts

### MCP runtime tools in real WeChat DevTools > covers every MCP runtime tool against the real IDE runtime

- Source: `e2e/ide/mcp-runtime-tools.runtime.test.ts:55`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/mcp-demo`; checkpoints: `[ { id: 'initial', route: INDEX_ROUTE, action: 'MCP reLaunch 后验收初始交互状态', nodes: [ { selector: '#mcp-tap-counter', text: 'tapCounter = 0' }, { selector: '#mcp-page-state', text: 'mcpStatus = idle' }, { selector: INPUT_SELECTOR, attributes: {`; source: `e2e/ide/mcp-runtime-tools.runtime.test.ts:56`
- Operations: `check(initial)`, `check(page-set)`, `check(page-method)`, `check(tapped)`, `check(input)`, `check(component-set)`, `check(component-method)`, `check(captured)`

## ide/plugin-demo.runtime.test.ts

### plugin-demo runtime (ide) > loads host page, renders plugin public components, and opens plugin vue page without runtime errors

- Source: `e2e/ide/plugin-demo.runtime.test.ts:298`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/plugin-demo`; checkpoints: `[ { id: 'host', route: HOST_ROUTE, action: 'launch plugin host', nodes: hostNodes(78) }, { id: 'host-updated', route: HOST_ROUTE, action: 'tap host progress button', nodes: hostNodes(84) }, { id: 'plugin-page', route: '__plugin__/wxb3d842a4`; source: `e2e/ide/plugin-demo.runtime.test.ts:306`
- Routes: `__plugin__/wxb3d842a4a7e3440d/pages/hello-page/index`, `/pages/index/index`, `plugin://hello-plugin/hello-page`
- Operations: `reLaunch(/pages/index/index)`, `check(host)`, `tap(<missing>)`, `check(host-updated)`, `navigateTo(plugin://hello-plugin/hello-page)`, `check(plugin-page)`

## ide/react-runtime-spike.runtime.test.ts

### react runtime spike (weapp e2e) > renders React hooks and dispatches host events through generic WXML

- Source: `e2e/ide/react-runtime-spike.runtime.test.ts:148`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `REACT_FIXTURE`; checkpoints: `[ counterCheckpoint({ id: 'initial', action: '首屏显示初始 hooks、context、输入和 keyed 列表', mode: 'generic', count: 0 }), counterCheckpoint({ id: 'incremented', action: '点击 increment 更新 count 和 memo doubled', mode: 'generic', count: 1 }), counterChec`; source: `e2e/ide/react-runtime-spike.runtime.test.ts:149`
- Operations: `reLaunch(GENERIC_ROUTE)`, `check(initial)`, `tap(<missing>)`, `check(incremented)`, `check(appended)`, `check(input-updated)`

### react runtime spike (weapp e2e) > renders the compiled native WXML page with binding-only payloads

- Source: `e2e/ide/react-runtime-spike.runtime.test.ts:170`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `REACT_FIXTURE`; checkpoints: `[ counterCheckpoint({ id: 'initial', action: '首屏显示静态绑定的 counter 和问候', mode: 'static', count: 0 }), counterCheckpoint({ id: 'incremented', action: '点击 increment 通过最小 setData payload 更新文本', mode: 'static', count: 1 }), counterCheckpoint({ id:`; source: `e2e/ide/react-runtime-spike.runtime.test.ts:171`
- Operations: `reLaunch(STATIC_ROUTE)`, `check(initial)`, `tap(<missing>)`, `check(incremented)`, `check(input-updated)`

### react runtime spike (weapp e2e) > passes props, change events and default slots across all six interop edges

- Source: `e2e/ide/react-runtime-spike.runtime.test.ts:218`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `REACT_FIXTURE`; checkpoints: `[ interopCheckpoint(0, runtimeProvider), ...INTEROP_EDGES.map((_, index) => interopCheckpoint(index + 1, runtimeProvider)), ]`; source: `e2e/ide/react-runtime-spike.runtime.test.ts:219`
- Operations: `reLaunch(INTEROP_ROUTE)`, `check(initial)`, `tap(<missing>)`, `check(edge.id)`, `callMethodWithOptions(_readInteropE2E)`

## ide/request-clients-real-native.runtime.test.ts

### e2e app: request-clients-real-native [cjs] > covers app-level request globals probe from a native app entry

- Source: `e2e/ide/request-clients-real-native.runtime.test.ts:269`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real-native`; checkpoints: `globalsCheckpoints(true)`; source: `e2e/ide/request-clients-real-native.runtime.test.ts:270`
- Routes: `/pages/index/index`
- Operations: `reLaunch(/pages/index/index)`, `check(initial)`, `callMethod(runE2E)`, `check(refreshed)`

### e2e app: request-clients-real-native [cjs] > covers fetch against a local real server

- Source: `e2e/ide/request-clients-real-native.runtime.test.ts:291`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real-native`; checkpoints: `requestCheckpoints('fetch', true)`; source: `e2e/ide/request-clients-real-native.runtime.test.ts:292`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real-native [cjs] > covers axios against a local real server

- Source: `e2e/ide/request-clients-real-native.runtime.test.ts:311`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real-native`; checkpoints: `requestCheckpoints('axios', true)`; source: `e2e/ide/request-clients-real-native.runtime.test.ts:312`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real-native [cjs] > covers graphql-request against a local real server

- Source: `e2e/ide/request-clients-real-native.runtime.test.ts:331`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real-native`; checkpoints: `requestCheckpoints('graphql-request', true)`; source: `e2e/ide/request-clients-real-native.runtime.test.ts:332`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real-native [cjs] > covers socket.io-client against a local real realtime server

- Source: `e2e/ide/request-clients-real-native.runtime.test.ts:351`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real-native`; checkpoints: `requestCheckpoints('socket-io', true)`; source: `e2e/ide/request-clients-real-native.runtime.test.ts:352`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real-native [cjs] > covers native WebSocket against a local real realtime server

- Source: `e2e/ide/request-clients-real-native.runtime.test.ts:386`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real-native`; checkpoints: `requestCheckpoints('websocket', true)`; source: `e2e/ide/request-clients-real-native.runtime.test.ts:387`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

## ide/request-clients-real.runtime.test.ts

### e2e app: request-clients-real [cjs] > exposes request globals from the Vue app runtime entry

- Source: `e2e/ide/request-clients-real.runtime.test.ts:276`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real`; checkpoints: `globalsCheckpoints(false)`; source: `e2e/ide/request-clients-real.runtime.test.ts:277`
- Routes: `/pages/index/index`
- Operations: `reLaunch(/pages/index/index)`, `check(initial)`, `callMethod(runE2E)`, `check(refreshed)`

### e2e app: request-clients-real [cjs] > covers fetch against a local real server

- Source: `e2e/ide/request-clients-real.runtime.test.ts:310`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real`; checkpoints: `requestCheckpoints('fetch')`; source: `e2e/ide/request-clients-real.runtime.test.ts:311`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real [cjs] > covers axios against a local real server

- Source: `e2e/ide/request-clients-real.runtime.test.ts:330`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real`; checkpoints: `requestCheckpoints('axios')`; source: `e2e/ide/request-clients-real.runtime.test.ts:331`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real [cjs] > covers graphql-request against a local real server

- Source: `e2e/ide/request-clients-real.runtime.test.ts:350`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real`; checkpoints: `requestCheckpoints('graphql-request')`; source: `e2e/ide/request-clients-real.runtime.test.ts:351`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real [cjs] > covers vue-query with tab switch, refetch and query key rotation against a local real server

- Source: `e2e/ide/request-clients-real.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real`; checkpoints: `QUERY_CHECKPOINTS`; source: `e2e/ide/request-clients-real.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(initial)`, `tap(<missing>)`, `check(overview)`, `check(detail)`, `check(refetched)`, `check(rotated)`

### e2e app: request-clients-real [cjs] > covers socket.io-client against a local real realtime server

- Source: `e2e/ide/request-clients-real.runtime.test.ts:404`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real`; checkpoints: `requestCheckpoints('socket-io')`; source: `e2e/ide/request-clients-real.runtime.test.ts:405`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

### e2e app: request-clients-real [cjs] > covers native WebSocket against a local real realtime server

- Source: `e2e/ide/request-clients-real.runtime.test.ts:434`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/request-clients-real`; checkpoints: `requestCheckpoints('websocket')`; source: `e2e/ide/request-clients-real.runtime.test.ts:435`
- Operations: `reLaunch(route)`, `check(initial)`, `callMethod(runE2E)`, `check(completed)`

## ide/shared-styles.runtime.test.ts

### e2e app: main-package shared styles > loads main, normal subpackage and independent subpackage styles in one session

- Source: `e2e/ide/shared-styles.runtime.test.ts:58`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `test/fixture-projects/weapp-vite/subPackages-shared-styles`; checkpoints: `sharedStyleCheckpoints(provider)`; source: `e2e/ide/shared-styles.runtime.test.ts:60`
- Routes: `/pages/index/index`, `/packageA/pages/foo/index`, `/packageB/pages/bar/index`
- Operations: `reLaunch(/pages/index/index)`, `check(main)`, `reLaunch(/packageA/pages/foo/index)`, `check(subpackage)`, `reLaunch(/packageB/pages/bar/index)`, `check(independent)`

## ide/stateful-hmr.runtime.test.ts

### stateful HMR in real WeChat DevTools > preserves native Page identity, data, input, route, and query across style updates and JavaScript patches

- Source: `e2e/ide/stateful-hmr.runtime.test.ts:308`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/stateful-hmr`; checkpoints: `statefulHmrCheckpoints('native')`; source: `e2e/ide/stateful-hmr.runtime.test.ts:309`
- Routes: `/pages/native/index?source=e2e`, `pages/native/index`
- Operations: `reLaunch(/pages/native/index?source=e2e)`, `check(initial)`, `tap(<missing>)`, `check(prepared)`, `check(style-updated)`, `check(patched)`, `check(updated)`, `check(restored)`, `check(restored-updated)`

### stateful HMR in real WeChat DevTools > rehydrates wevu local and store refs while preserving the native page instance

- Source: `e2e/ide/stateful-hmr.runtime.test.ts:368`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/stateful-hmr`; checkpoints: `statefulHmrCheckpoints('wevu')`; source: `e2e/ide/stateful-hmr.runtime.test.ts:369`
- Routes: `/pages/wevu/index?source=e2e`, `pages/wevu/index`
- Operations: `reLaunch(/pages/wevu/index?source=e2e)`, `check(initial)`, `tap(<missing>)`, `check(prepared)`, `check(template-b)`, `check(template-a)`, `check(patched)`, `check(updated)`, `check(mixed-style)`, `check(mixed-style-updated)`

### stateful HMR in real WeChat DevTools > preserves native Component identity, data, input, route, and query across a JavaScript patch

- Source: `e2e/ide/stateful-hmr.runtime.test.ts:450`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/stateful-hmr`; checkpoints: `statefulHmrCheckpoints('component')`; source: `e2e/ide/stateful-hmr.runtime.test.ts:451`
- Routes: `/pages/component/index?source=e2e`, `pages/component/index`
- Operations: `reLaunch(/pages/component/index?source=e2e)`, `check(initial)`, `tap(<missing>)`, `check(prepared)`, `check(patched)`, `check(updated)`

### stateful HMR in real WeChat DevTools > preserves parent and native child DOM state across a child script patch and restoration

- Source: `e2e/ide/stateful-hmr.runtime.test.ts:490`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/stateful-hmr`; checkpoints: `nativeChildCheckpoints`; source: `e2e/ide/stateful-hmr.runtime.test.ts:491`

### stateful HMR in real WeChat DevTools > preserves parent and Vue child DOM state across a child script patch and restoration

- Source: `e2e/ide/stateful-hmr.runtime.test.ts:512`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/stateful-hmr`; checkpoints: `vueChildCheckpoints`; source: `e2e/ide/stateful-hmr.runtime.test.ts:513`

## ide/subpackage-shared-strategy-complex.runtime.test.ts

### e2e app: subpackage-shared-strategy-complex-a runtime > reLaunches all key routes and renders shared markers

- Source: `e2e/ide/subpackage-shared-strategy-complex.runtime.test.ts:184`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/subpackage-shared-strategy-complex-a`; checkpoints: `checkpoints`; source: `e2e/ide/subpackage-shared-strategy-complex.runtime.test.ts:185`
- Routes: `/pages/index/index`, `/subpackages/item/index`, `/subpackages/user/index`, `/subpackages/report/index`
- Operations: `reLaunch(/pages/index/index)`, `check(checkpoint.id)`, `reLaunch(/subpackages/item/index)`, `reLaunch(/subpackages/user/index)`, `reLaunch(/subpackages/report/index)`

### e2e app: subpackage-shared-strategy-complex-b runtime > reLaunches all key routes and renders shared markers

- Source: `e2e/ide/subpackage-shared-strategy-complex.runtime.test.ts:184`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/subpackage-shared-strategy-complex-b`; checkpoints: `checkpoints`; source: `e2e/ide/subpackage-shared-strategy-complex.runtime.test.ts:185`
- Routes: `/pages/home/index`, `/subpackages/alpha/index`, `/subpackages/beta/index`, `/subpackages/gamma/index`
- Operations: `reLaunch(/pages/home/index)`, `check(checkpoint.id)`, `reLaunch(/subpackages/alpha/index)`, `reLaunch(/subpackages/beta/index)`, `reLaunch(/subpackages/gamma/index)`

## ide/swan-runtime.optional.test.ts

Optional Baidu host runtime is outside WeChat DOM acceptance

### optional Baidu runtime smoke > reuses one session and relaunches the index route

- Source: `e2e/ide/swan-runtime.optional.test.ts:42`
- Plan: MISSING
- Missing createDomAcceptance plan; existing DOM/data assertions do not produce acceptance evidence

## ide/tdesign-dialog-import.runtime.test.ts

### e2e app: tdesign-dialog-import (runtime) > keeps bare dialog import callable in DevTools runtime

- Source: `e2e/ide/tdesign-dialog-import.runtime.test.ts:342`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/tdesign-dialog-import`; checkpoints: `dialogImportCheckpoints('bare')`; source: `e2e/ide/tdesign-dialog-import.runtime.test.ts:343`
- Routes: `/pages/dialog-bare/index`
- Operations: `reLaunch(/pages/dialog-bare/index)`, `callMethod(_runE2E)`, `callMethod(_debugE2E)`, `check(initial)`, `callMethod(_resetE2E)`, `check(reset)`, `tap(<missing>)`, `check(open)`, `check(cancel)`, `callMethod(_openDialogE2E)`, `check(reopen)`, `check(confirm)`, `check(toast)`

### e2e app: tdesign-dialog-import (runtime) > keeps explicit /index dialog import callable in DevTools runtime

- Source: `e2e/ide/tdesign-dialog-import.runtime.test.ts:365`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/tdesign-dialog-import`; checkpoints: `dialogImportCheckpoints('index')`; source: `e2e/ide/tdesign-dialog-import.runtime.test.ts:366`
- Routes: `/pages/dialog-index/index`
- Operations: `reLaunch(/pages/dialog-index/index)`, `callMethod(_runE2E)`, `callMethod(_debugE2E)`, `check(initial)`, `callMethod(_resetE2E)`, `check(reset)`, `tap(<missing>)`, `check(open)`, `check(cancel)`, `callMethod(_openDialogE2E)`, `check(reopen)`, `check(confirm)`, `check(toast)`

## ide/template-dev-open-all.runtime.test.ts

### all templates dev:open IDE integration > weapp-vite-plugin-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-multi-platform-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-multi-platform-sfc-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-lib-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-tailwindcss-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-tailwindcss-tdesign-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-tailwindcss-vant-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-wevu-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-wevu-tailwindcss-tdesign-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

### all templates dev:open IDE integration > weapp-vite-wevu-tailwindcss-tdesign-retail-template renders after dev:open without runtime errors

- Source: `e2e/ide/template-dev-open-all.runtime.test.ts:370`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-dev-open-all.runtime.test.ts:371`
- Operations: `reLaunch(route)`, `check(opened)`

## ide/template-multi-platform-sfc.swan.optional.test.ts

Optional Baidu host runtime is outside WeChat DOM acceptance

### optional multi-platform SFC template Baidu runtime smoke > reuses one session and exposes the SFC runtime state

- Source: `e2e/ide/template-multi-platform-sfc.swan.optional.test.ts:45`
- Plan: MISSING
- Missing createDomAcceptance plan; existing DOM/data assertions do not produce acceptance evidence

## ide/template-multi-platform.swan.optional.test.ts

Optional Baidu host runtime is outside WeChat DOM acceptance

### optional multi-platform template Baidu runtime smoke > reuses one session and exposes the template runtime state

- Source: `e2e/ide/template-multi-platform.swan.optional.test.ts:45`
- Plan: MISSING
- Missing createDomAcceptance plan; existing DOM/data assertions do not produce acceptance evidence

## ide/template-retail-checkout.runtime.test.ts

### retail checkout nullable settlement rendering > renders nullable settlement results and refreshes quantity and amount after reLaunch

- Source: `e2e/ide/template-retail-checkout.runtime.test.ts:57`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template`; checkpoints: `[{ id: 'home-ready', route: '/pages/home/home', action: '从首页启动并确认首屏商品已经呈现，再进入结算分包', nodes: [{ selector: '.goods-card__title', scope: [{ has: '.goods-list-wrap' }, '#home-goods-list-gd-0'], text: '白色短袖连衣裙荷叶边裙摆宽松韩版休闲纯白清爽优雅连衣裙', }], }, ...scen`; source: `e2e/ide/template-retail-checkout.runtime.test.ts:63`
- Routes: `/pages/home/home`, `${RETAIL_CHECKOUT_ROUTE}?type=cart`
- Operations: `act(home-ready)`, `reLaunch(/pages/home/home)`, `check(home-ready)`, `act(scenario.id)`, `reLaunch(${RETAIL_CHECKOUT_ROUTE}?type=cart)`, `check(scenario.id)`

## ide/template-tailwindcss-dev-open-multi.runtime.test.ts

### template TailwindCSS dev:open multi-project IDE integration > weapp-vite-tailwindcss-template renders after the previous dev:open process exits

- Source: `e2e/ide/template-tailwindcss-dev-open-multi.runtime.test.ts:114`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-tailwindcss-dev-open-multi.runtime.test.ts:115`
- Operations: `reLaunch(route)`, `check(opened)`

### template TailwindCSS dev:open multi-project IDE integration > weapp-vite-tailwindcss-tdesign-template renders after the previous dev:open process exits

- Source: `e2e/ide/template-tailwindcss-dev-open-multi.runtime.test.ts:114`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-tailwindcss-dev-open-multi.runtime.test.ts:115`
- Operations: `reLaunch(route)`, `check(opened)`

### template TailwindCSS dev:open multi-project IDE integration > weapp-vite-tailwindcss-vant-template renders after the previous dev:open process exits

- Source: `e2e/ide/template-tailwindcss-dev-open-multi.runtime.test.ts:114`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/${templateCase.name}`; checkpoints: `[templateDevOpenCheckpoint(templateCase)]`; source: `e2e/ide/template-tailwindcss-dev-open-multi.runtime.test.ts:115`
- Operations: `reLaunch(route)`, `check(opened)`

## ide/template-tailwindcss-tdesign-hmr.runtime.test.ts

### template TailwindCSS TDesign HMR in real WeChat DevTools > updates and restores native Page methods with external npm while retaining rendered interaction state

- Source: `e2e/ide/template-tailwindcss-tdesign-hmr.runtime.test.ts:214`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/weapp-vite-tailwindcss-tdesign-template`; checkpoints: `tdesignNativeScriptCheckpoints`; source: `e2e/ide/template-tailwindcss-tdesign-hmr.runtime.test.ts:215`
- Operations: `check(native-script:initial)`, `tap(<missing>)`, `check(native-script:dark)`, `check(native-script:patched-state)`, `check(native-script:patched-tap)`, `check(native-script:restored-state)`, `check(native-script:restored-tap)`

### template TailwindCSS TDesign HMR in real WeChat DevTools > updates the visible Tailwind arbitrary background color through dev HMR

- Source: `e2e/ide/template-tailwindcss-tdesign-hmr.runtime.test.ts:241`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/weapp-vite-tailwindcss-tdesign-template`; checkpoints: `[ { id: 'tailwind:initial', route: INDEX_ROUTE, action: '初始浅色背景的计算样式、布局和模式文本', nodes: [ { selector: \`#${PROBE_ID}\`, styles: { 'background-color': 'rgb(243, 244, 246)' }, visible: true }, { selector: '#tailwind-mode', text: '当前模式 light 切换模式'`; source: `e2e/ide/template-tailwindcss-tdesign-hmr.runtime.test.ts:242`
- Operations: `check(tailwind:initial)`, `tap(<missing>)`, `check(tailwind:dark)`, `check(tailwind:hmr-preserved)`, `check(tailwind:updated)`, `check(tailwind:updated-dark)`

## ide/template-weapp-vite-multi-platform-sfc-template.test.ts

### template e2e: weapp-vite-multi-platform-sfc-template > renders and updates the WeChat SFC target

- Source: `e2e/ide/template-weapp-vite-multi-platform-sfc-template.test.ts:11`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `multiPlatformTemplateDom(true)`; source: `e2e/ide/template-weapp-vite-multi-platform-sfc-template.test.ts:12`

## ide/template-weapp-vite-multi-platform-template.test.ts

### template e2e: weapp-vite-multi-platform-template > renders and updates the WeChat target

- Source: `e2e/ide/template-weapp-vite-multi-platform-template.test.ts:11`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `multiPlatformTemplateDom(false)`; source: `e2e/ide/template-weapp-vite-multi-platform-template.test.ts:12`

## ide/template-weapp-vite-tailwindcss-tdesign-template.test.ts

### template e2e: weapp-vite-tailwindcss-tdesign-template > renders all pages from app config

- Source: `e2e/ide/template-weapp-vite-tailwindcss-tdesign-template.test.ts:8`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `tailwindTemplateDom('tdesign')`; source: `e2e/ide/template-weapp-vite-tailwindcss-tdesign-template.test.ts:9`

## ide/template-weapp-vite-tailwindcss-template.test.ts

### template e2e: weapp-vite-tailwindcss-template > renders all pages from app config

- Source: `e2e/ide/template-weapp-vite-tailwindcss-template.test.ts:8`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `tailwindTemplateDom('tailwind')`; source: `e2e/ide/template-weapp-vite-tailwindcss-template.test.ts:9`

## ide/template-weapp-vite-tailwindcss-vant-template.test.ts

### template e2e: weapp-vite-tailwindcss-vant-template > renders all pages from app config

- Source: `e2e/ide/template-weapp-vite-tailwindcss-vant-template.test.ts:8`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `tailwindTemplateDom('vant')`; source: `e2e/ide/template-weapp-vite-tailwindcss-vant-template.test.ts:9`

## ide/template-weapp-vite-template.test.ts

### template e2e: weapp-vite-template > renders all pages from app config in esm

- Source: `e2e/ide/template-weapp-vite-template.test.ts:11`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `NATIVE_TEMPLATE_DOM`; source: `e2e/utils/templateAcceptance/native.ts`

### template e2e: weapp-vite-template > renders all pages from app config in cjs

- Source: `e2e/ide/template-weapp-vite-template.test.ts:11`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `NATIVE_TEMPLATE_DOM`; source: `e2e/utils/templateAcceptance/native.ts`

## ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts

### template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime > renders the home page in WeChat DevTools

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:206`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `RETAIL_FIXTURE`; checkpoints: `[retailHomeCheckpoint('initial', '打开首页检查四张商品卡、首件商品和分类')]`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:207`
- Routes: `/pages/home/home`
- Operations: `switchTab(/pages/home/home)`, `reLaunch(/pages/home/home)`, `check(initial)`

### template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime > does not emit runtime warnings when layout toast is triggered from home page

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:232`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `RETAIL_FIXTURE`; checkpoints: `[ retailHomeCheckpoint('initial', '检查加入购物车前的商品列表'), { id: 'cart-toast', route: HOME_ROUTE, action: '点击首件商品的购物车按钮并检查 layout Toast', nodes: [classText('t-toast__text', '点击加入购物车')] }, { id: 'toast-closed', route: HOME_ROUTE, action: 'Toast 关闭后`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:233`
- Routes: `/pages/home/home`
- Operations: `switchTab(/pages/home/home)`, `reLaunch(/pages/home/home)`, `check(initial)`, `check(cart-toast)`, `check(toast-closed)`

### template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime > navigates from home goods card through component click event wiring

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:261`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `RETAIL_FIXTURE`; checkpoints: `[ retailHomeCheckpoint('initial', '检查准备点击的首件商品'), { id: 'goods-detail', route: GOODS_DETAIL_PATH, action: '点击真实商品标题，通过 goods-card 和 goods-list 事件进入详情', nodes: [classText('goods-name', RETAIL_FIRST_TITLE), classText('desc-content__title--tex`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:262`
- Routes: `/pages/home/home`
- Operations: `switchTab(/pages/home/home)`, `reLaunch(/pages/home/home)`, `check(initial)`, `check(goods-detail)`

### template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime > does not emit runtime warnings when layout dialog is triggered from home page

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:302`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `RETAIL_FIXTURE`; checkpoints: `[ retailHomeCheckpoint('initial', '打开弹窗前检查首页商品列表'), { id: 'dialog-open', route: HOME_ROUTE, action: '调用页面反馈操作并检查真实 layout 弹窗', nodes: [classText('t-dialog__header', '布局弹窗'), classText('t-dialog__body-text', '验证 layout dialog 选择器桥接'), { sele`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts:303`
- Routes: `/pages/home/home`
- Operations: `switchTab(/pages/home/home)`, `reLaunch(/pages/home/home)`, `check(initial)`, `callMethodWithOptions(showLayoutDialogProbe)`, `check(dialog-open)`, `check(dialog-closed)`

## ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts

### template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template parity > keeps WXML DOM structure aligned with tdesign-miniprogram-starter-retail

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts:813`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template`; checkpoints: `routes.flatMap(route => route.steps)`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts:820`
- Operations: `callMethod(step.method)`, `check(step.id)`

## ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test.ts

### e2e app: template-wevu-tdesign-regression class/style binding lab > covers class/style binding branches with interactive scenarios

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test.ts:40`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `classBindingCheckpoints`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test.ts:41`
- Operations: `check(initial)`, `callMethod(applyScenarioBase)`, `check(base)`, `callMethod(applyScenarioAllOn)`, `check(all-on)`, `callMethod(applyScenarioMixed)`, `check(mixed)`, `callMethod(applyScenarioErrorGhost)`, `check(error-ghost)`

## ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test.ts

### e2e app: template-wevu-tdesign-regression form > renders urgent controls and exposes initial urgent runtime state

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test.ts:92`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `[ { id: 'initial', route: ROUTE, action: '打开表单并检查加急默认状态', nodes: [renderedText('form-urgent-state', '加急未开启 · 平衡'), { selector: '//*[@aria-role="switch"]', query: 'xpath', attributes: { 'aria-checked': 'false' } }] }, { id: 'urgent-on', rout`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test.ts:93`
- Routes: `/pages/form/index`
- Operations: `switchTab(/pages/form/index)`, `check(initial)`, `check(urgent-on)`, `check(urgent-off)`, `check(switch-on)`

## ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts

### e2e app: template-wevu-tdesign-regression layout feedback dialog > closes page alert dialog after confirming

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts:107`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `[ feedbackCheckpoint('initial', '重置后检查空日志与关闭状态'), dialogCheckpoint('alert-open', 'Alert'), feedbackCheckpoint('alert-confirmed', '确认后检查弹窗关闭和实际回调日志', '页面 Alert #1 已确认'), ]`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts:108`
- Operations: `callMethodWithOptions(inspectDialogHostJsonE2E)`, `callMethodWithOptions(resetLayoutFeedbackE2E)`, `check(initial)`, `callMethodWithOptions(runPageAlertCloseE2E)`, `check(alert-open)`, `callMethodWithOptions(runDialogHostConfirmE2E)`, `check(alert-confirmed)`, `callMethodWithOptions(getLayoutFeedbackLogsE2E)`

### e2e app: template-wevu-tdesign-regression layout feedback dialog > closes page confirm dialog after canceling and confirming

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts:148`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `[ feedbackCheckpoint('initial', '重置后检查空日志与关闭状态'), dialogCheckpoint('cancel-open', 'Confirm'), feedbackCheckpoint('canceled', '取消后检查弹窗消失和回调日志', '页面 Confirm #1 点击取消'), feedbackCheckpoint('reset', '再次重置后检查空日志和关闭状态'), dialogCheckpoint('confirm-`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts:149`
- Operations: `callMethodWithOptions(inspectDialogHostJsonE2E)`, `callMethodWithOptions(resetLayoutFeedbackE2E)`, `check(initial)`, `callMethodWithOptions(runPageConfirmOpenE2E)`, `check(cancel-open)`, `callMethodWithOptions(runDialogHostCancelE2E)`, `check(canceled)`, `callMethodWithOptions(getLayoutFeedbackLogsE2E)`, `check(reset)`, `check(confirm-open)`, `callMethodWithOptions(runDialogHostConfirmE2E)`, `check(confirmed)`

### e2e app: template-wevu-tdesign-regression layout feedback dialog > can close dialog host via native confirm/cancel methods

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts:218`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `[ feedbackCheckpoint('initial', '检查原生宿主初始关闭状态'), dialogCheckpoint('native-alert-open', 'Alert'), feedbackCheckpoint('native-alert-confirmed', '原生确认后检查实际日志和关闭状态', '页面 Alert #1 已确认'), dialogCheckpoint('native-confirm-open', 'Confirm', 2), fee`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts:219`
- Operations: `callMethodWithOptions(inspectDialogHostJsonE2E)`, `callMethodWithOptions(resetLayoutFeedbackE2E)`, `check(initial)`, `callMethodWithOptions(runPageAlertCloseE2E)`, `check(native-alert-open)`, `callMethodWithOptions(runDialogHostConfirmE2E)`, `check(native-alert-confirmed)`, `callMethodWithOptions(runPageConfirmOpenE2E)`, `check(native-confirm-open)`, `callMethodWithOptions(runDialogHostCancelE2E)`, `check(native-confirm-canceled)`

## ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts

### e2e app: template-wevu-tdesign-regression runtime errors > does not emit runtime console errors when opening layout pages

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts:93`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `[ { id: 'dashboard', route: '/pages/index/index', action: '打开首页，检查 KPI 首屏', nodes: dashboardNodes() }, { id: 'layouts', route: '/pages/layouts/index', action: '打开布局页，检查当前状态和三个布局选项', nodes: layoutNodes }, ]`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts:94`
- Routes: `/pages/index/index`, `/pages/layouts/index`
- Operations: `check(route === '/pages/index/index' ? 'dashboard' : 'layouts')`

### e2e app: template-wevu-tdesign-regression runtime errors > does not emit runtime console errors when homepage layout toast is triggered

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts:119`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `[ { id: 'initial', route: '/pages/index/index', action: '检查刷新前的 KPI', nodes: dashboardNodes() }, { id: 'refreshed', route: '/pages/index/index', action: '刷新后检查四张指标卡和真实 Toast', nodes: [classText('t-toast__text', '指标已刷新'), ...dashboardNodes(t`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts:120`
- Routes: `/pages/index/index`
- Operations: `check(initial)`, `callMethod(runLayoutToastE2E)`, `check(refreshed)`, `check(toast-closed)`

### e2e app: template-wevu-tdesign-regression runtime errors > emits homepage KpiBoard scoped slot items without runtime errors

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts:156`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `TDESIGN_FIXTURE`; checkpoints: `[ { id: 'scoped-slot-items', route: '/pages/index/index', action: '检查作用域插槽实际渲染的四组标签与值', nodes: dashboardNodes() }, ]`; source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts:157`
- Routes: `/pages/index/index`
- Operations: `check(scoped-slot-items)`

## ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.test.ts

### template e2e: weapp-vite-wevu-tailwindcss-tdesign-template > renders all pages from app config

- Source: `e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.test.ts:8`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `WEVU_TDESIGN_TEMPLATE_DOM`; source: `e2e/utils/templateAcceptance/wevu.ts`

## ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts

### e2e app: template-wevu-regression simplified portal > emits the simplified portal structure and auto-imported component usage

- Source: `e2e/ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts:50`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/template-wevu-regression`; checkpoints: `[ { id: 'portal', route: '/pages/index/index', action: 'launch portal', nodes: homeNodes }, ...targets.flatMap(target => [ { id: target.id, route: target.route, action: \`tap ${target.title} portal entry\`, nodes: [ { selector: '.card__title'`; source: `e2e/ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts:70`
- Routes: `/pages/overview/index`, `/packageA/pages/workspace/index`, `/packageB/pages/settings/index`, `/pages/index/index`
- Operations: `reLaunch(/pages/index/index)`, `check(portal)`, `tap(<missing>)`, `check(target.id)`, `callMethodWithOptions(waitForNavigation)`, `check(${target.id}-return)`

## ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts

### e2e app: template-wevu-regression layouts runtime > switches between default/admin/none layouts at runtime

- Source: `e2e/ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts:290`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/template-wevu-regression`; checkpoints: `templateLayoutCheckpoints`; source: `e2e/ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts:291`
- Routes: `/pages/layouts/index`
- Operations: `reLaunch(/pages/layouts/index)`, `check(initial)`, `callMethod(applyAdminLayout)`, `check(admin)`, `callMethod(clearLayout)`, `check(none)`, `callMethod(applyDefaultLayout)`, `check(default)`

## ide/template-weapp-vite-wevu-template.test.ts

### template e2e: weapp-vite-wevu-template > renders all pages from app config in esm

- Source: `e2e/ide/template-weapp-vite-wevu-template.test.ts:11`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `WEVU_TEMPLATE_DOM`; source: `e2e/utils/templateAcceptance/wevu.ts`

### template e2e: weapp-vite-wevu-template > renders all pages from app config in cjs

- Source: `e2e/ide/template-weapp-vite-wevu-template.test.ts:11`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `TEMPLATE_ROOT`; checkpoints: `WEVU_TEMPLATE_DOM`; source: `e2e/utils/templateAcceptance/wevu.ts`

## ide/template-wevu-features-app.test.ts

### template e2e: wevu-features-app > renders all pages from app config

- Source: `e2e/ide/template-wevu-features-app.test.ts:8`
- Plan: registered in source; runtime verification required
- Registration: `runTemplateE2E`; fixture: `APP_ROOT`; checkpoints: `WEVU_FEATURES_TEMPLATE_DOM`; source: `e2e/utils/templateAcceptance/features.ts`

## ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts

### template wevu TailwindCSS TDesign HMR in real WeChat DevTools > serializes consecutive arbitrary background updates without reloading the page stack

- Source: `e2e/ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts:337`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `templates/weapp-vite-wevu-tailwindcss-tdesign-template`; checkpoints: `[...colors.map((color, index) => ({ id: \`background:${index}\`, route: INDEX_ROUTE, action: \`背景阶段 ${index}：计算样式、布局与点击计数\`, nodes: [ { selector: \`#${PROBE_ID}\`, styles: { 'background-color': color }, visible: true }, { selector: '#count-label'`; source: `e2e/ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts:339`
- Operations: `check(background:0)`, `callMethodWithOptions(handleCountTap)`, `check(background:1)`, `check(background:${updateIndex + 2})`, `check(local-style-priority)`

## ide/vite-native-ts.worker.runtime.test.ts

### e2e app: vite-native-ts worker runtime > preloads worker subpackage and receives the first worker message without runtime errors

- Source: `e2e/ide/vite-native-ts.worker.runtime.test.ts:87`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/vite-native-ts`; checkpoints: `[{ id: 'worker-ready', route: ROUTE, action: '冷启动并检查页面实际呈现的首条 worker 消息', nodes: [ { selector: '.worker-status', text: 'worker-status: ready' }, { selector: '.worker-message', text: 'worker-message: hello' }, ], }]`; source: `e2e/ide/vite-native-ts.worker.runtime.test.ts:88`
- Operations: `check(worker-ready)`

## ide/vue-mini-issue151-wevu.runtime.test.ts

### e2e app: vue-mini issue #151 / wevu > keeps onReady hooks isolated from PageInstance **onReady** in base lib 3.16.2

- Source: `e2e/ide/vue-mini-issue151-wevu.runtime.test.ts:85`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/vue-mini-issue151-wevu`; checkpoints: `[{ id: 'ready-hooks', route: ISSUE_151_ROUTE, action: 'switchTab to issue151 and await page/custom-tabbar onReady', nodes: [ { selector: '.issue151-title', text: 'vue-mini issue-151 onReady collision probe' }, { selector: '.issue151-probe',`; source: `e2e/ide/vue-mini-issue151-wevu.runtime.test.ts:86`
- Routes: `/pages/issue-151/index`
- Operations: `switchTab(/pages/issue-151/index)`, `check(ready-hooks)`

## ide/wevu-composition-api.weapp.test.ts

### wevu composition api (weapp e2e) > covers all public composition APIs on the TS page

- Source: `e2e/ide/wevu-composition-api.weapp.test.ts:100`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `[ { id: 'composition:initial', route, action: '检查组合式 API 初始绑定值', nodes: [ { selector: \`#api-ref${suffix}\`, text: vue ? 'composition api vue anchor' : 'composition api anchor' }, { selector: '#composition-reactive', text: 'reactive: 0 / 1' }`; source: `e2e/ide/wevu-composition-api.weapp.test.ts:44`
- Routes: `/pages/composition-api/index`
- Operations: `reLaunch(/pages/composition-api/index)`, `check(composition:initial)`, `callMethodWithOptions(runE2E)`, `check(composition:result)`

### wevu composition api (weapp e2e) > covers all public composition APIs on the Vue SFC page

- Source: `e2e/ide/wevu-composition-api.weapp.test.ts:111`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `[ { id: 'composition:initial', route, action: '检查组合式 API 初始绑定值', nodes: [ { selector: \`#api-ref${suffix}\`, text: vue ? 'composition api vue anchor' : 'composition api anchor' }, { selector: '#composition-reactive', text: 'reactive: 0 / 1' }`; source: `e2e/ide/wevu-composition-api.weapp.test.ts:44`
- Routes: `/pages/composition-api-vue/index`
- Operations: `reLaunch(/pages/composition-api-vue/index)`, `check(composition:initial)`, `callMethodWithOptions(runE2E)`, `check(composition:result)`

## ide/wevu-features.runtime.behavior.test.ts

### e2e app: wevu-features / behavior > renders attrs changes and removes the conditional child content

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:24`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏渲染父控件和 attrs 子组件', attrsNodes(false)), checkpoint('updated', '切换 tone、visible、边框并递增 seed', attrsNodes(true)), checkpoint('visible-again', '重新显示 attrs 子节点并检查最新 seed', [ textNode('#ctrl-toggle-visible', '切换 visible：`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:25`
- Routes: `/pages/use-attrs/index`

### e2e app: wevu-features / behavior > renders slot removal and the updated default slot after reopening

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:44`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏展开 header 和 default slots', [ textNode('#slots-panel', 'panel: open', ['#slots-feature']), textNode('.use-slots-page__header', 'header slot content'), textNode('.use-slots-page__body', 'default slot content 1'), ]`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:45`
- Routes: `/pages/use-slots/index`

### e2e app: wevu-features / behavior > renders parent and child model updates in both directions

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:73`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏显示父子 model 和 title', modelNodes('seed-model', 0)), checkpoint('parent-update', '父页面设置 alpha model', modelNodes('alpha-from-parent', 1)), checkpoint('child-update', '子组件设置 model 并同步父页面', modelNodes('alpha-from-chil`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:74`
- Routes: `/pages/use-model/index`

### e2e app: wevu-features / behavior > renders null model input as empty text in both parent and child

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:91`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏 seed model', modelNodes('seed-model', 0)), checkpoint('null-cleared', '父页面写入 null 后父子文本同时清空', modelNodes('', 1)), ]`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:92`
- Routes: `/pages/use-model/index`

### e2e app: wevu-features / behavior > renders provide/inject state changes from both provider and consumer

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:103`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏 provider 与 inject 状态一致', provideNodes(1, 'teal', 'init:provider')), checkpoint('provider-update', 'provider 递增计数并切换主题', provideNodes(2, 'amber', 'theme:provider')), checkpoint('consumer-update', 'inject 组件递增共享计数'`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:104`
- Routes: `/pages/use-provide-inject/index`

### e2e app: wevu-features / behavior > renders app, layout, page, deep component and slot injection scopes

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:118`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏深层及 slot 组件实际渲染每层注入值', injectionScopeNodes()), checkpoint('scope-verified', '执行作用域语义检查后 DOM 值保持一致', injectionScopeNodes()), ]`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:119`
- Routes: `/pages/use-provide-inject-scope/index`

### e2e app: wevu-features / behavior > renders store mutations, computed values and resets as separate checkpoints

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:131`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏 setup/options stores 初始状态', storeNodes(false)), checkpoint('mutated', '执行 action、patch 和 storeToRefs 写入，保留 reset 前状态', storeNodes(true)), checkpoint('reset', 'reset 后计数、派生值、标签和集合恢复初始状态', storeNodes(false)), ]`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:132`
- Routes: `/pages/use-store/index`

### e2e app: wevu-features / behavior > renders static and reactive props across the native to Vue component boundary

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:168`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏静态链路和响应式链路的 Vue 内层文本', nativeNodes(false)), checkpoint('updated', '切换 mode 并递增 count 后内层 Vue 文本更新', nativeNodes(true)), ]`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:169`
- Routes: `/pages/native-uses-vue/index`

### e2e app: wevu-features / behavior > renders scoped CSS, CSS Modules and reactive CSS variables

- Source: `e2e/ide/wevu-features.runtime.behavior.test.ts:180`
- Plan: registered in source; runtime verification required
- Registration: `withBehaviorPage`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ checkpoint('initial', '首屏 CSS Modules、scoped 节点和红色背景', styleNodes(false)), checkpoint('updated', '更新 CSS 变量后保持布局并渲染蓝色背景', styleNodes(true)), ]`; source: `e2e/ide/wevu-features.runtime.behavior.test.ts:181`
- Routes: `/pages/sfc-styles/index`

## ide/wevu-features.runtime.router.test.ts

### e2e app: wevu-features / router > resolves component this.router.navigateTo relative route using component base path

- Source: `e2e/ide/wevu-features.runtime.router.test.ts:81`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ routerCheckpoint('index', ROUTER_INDEX_ROUTE, '首屏显示进入 sub 页的操作', routerIndexNodes), routerCheckpoint('sub', ROUTER_SUB_ROUTE, '进入 sub 页并渲染 RouterOriginProbe 组件', routerSubNodes), routerCheckpoint('component-target', ROUTER_COMPONENT_TARGE`; source: `e2e/ide/wevu-features.runtime.router.test.ts:82`
- Operations: `reLaunch(ROUTER_INDEX_ROUTE)`, `check(index)`, `check(sub)`, `check(component-target)`

### e2e app: wevu-features / router > resolves pageRouter.navigateTo relative route using page base path

- Source: `e2e/ide/wevu-features.runtime.router.test.ts:103`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ routerCheckpoint('index', ROUTER_INDEX_ROUTE, '首屏显示 pageRouter 相对导航操作', routerIndexNodes), routerCheckpoint('page-target', ROUTER_PAGE_TARGET, '相对导航后渲染页面目录目标路径和来源', routerTargetNodes('page')), ]`; source: `e2e/ide/wevu-features.runtime.router.test.ts:104`
- Operations: `reLaunch(ROUTER_INDEX_ROUTE)`, `check(index)`, `check(page-target)`

### e2e app: wevu-features / router > renders router query, resolved paths and aborted navigation results

- Source: `e2e/ide/wevu-features.runtime.router.test.ts:119`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ routerCheckpoint('initial', SHOWCASE_ROUTE, '首屏展示未执行的 router showcase 结果', showcaseNodes(false)), routerCheckpoint('resolved', SHOWCASE_ROUTE, '执行 query、路由解析和不支持的导航后渲染每项结果', showcaseNodes(true)), ]`; source: `e2e/ide/wevu-features.runtime.router.test.ts:120`
- Operations: `reLaunch(SHOWCASE_ROUTE)`, `check(initial)`, `check(resolved)`

### e2e app: wevu-features / router > renders dynamic route removal, options snapshot and guard failure results

- Source: `e2e/ide/wevu-features.runtime.router.test.ts:146`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ routerCheckpoint('initial', DYNAMIC_ROUTE, '首屏展示未执行的 dynamic router 结果', dynamicNodes(false)), routerCheckpoint('completed', DYNAMIC_ROUTE, '动态路由增删和 guard 失败后渲染路径、计数及错误', dynamicNodes(true)), ]`; source: `e2e/ide/wevu-features.runtime.router.test.ts:148`
- Operations: `reLaunch(DYNAMIC_ROUTE)`, `check(initial)`, `check(completed)`

## ide/wevu-features.runtime.subpath.test.ts

### e2e app: wevu-features / subpath > covers wevu subpath entries: router/store/api/fetch in one page scenario

- Source: `e2e/ide/wevu-features.runtime.subpath.test.ts:19`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-features`; checkpoints: `[ { id: 'subpath:initial', route: SUBPATH_ROUTE, action: '检查子路径页面初始结果', nodes: [ { selector: '.subpath-entries-page__title', text: SUBPATH_READY_TEXT }, { selector: '#subpath-store-summary', text: 'store count/label = 0 / init' }, { selecto`; source: `e2e/ide/wevu-features.runtime.subpath.test.ts:20`
- Operations: `check(subpath:initial)`, `check(subpath:result)`

## ide/wevu-jsx-tsx.hmr.runtime.test.ts

### wevu JSX/TSX stateful HMR in real WeChat DevTools > preserves instance state while replacing shared TSX and island handlers

- Source: `e2e/ide/wevu-jsx-tsx.hmr.runtime.test.ts:120`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-jsx-tsx-demo`; checkpoints: `[ { id: 'tsx:initial', route: ROUTE, action: '检查初始模板和动态岛计数', nodes: [ { selector: '.title', text: '纯 TSX（.tsx）' }, { selector: '#tsx-island-button', text: 'dynamic island: 0' }, ] }, { id: 'tsx:interacted', route: ROUTE, action: '动态岛交互后记录计数`; source: `e2e/ide/wevu-jsx-tsx.hmr.runtime.test.ts:122`
- Routes: `/pages/tsx-basic/index`, `pages/tsx-basic/index`
- Operations: `reLaunch(/pages/tsx-basic/index)`, `check(tsx:initial)`, `callMethodWithOptions(runE2E)`, `check(tsx:interacted)`, `check(tsx:shared-updated)`, `check(tsx:page-updated)`, `tap(<missing>)`, `check(tsx:handler-updated)`

## ide/wevu-jsx-tsx.runtime.test.ts

### wevu JSX/TSX runtime [${runtimeProvider}] > runs JSX and Vue-imported TSX option components

- Source: `e2e/ide/wevu-jsx-tsx.runtime.test.ts:58`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-jsx-tsx-demo`; checkpoints: `JSX_OPTION_CHECKPOINTS`; source: `e2e/ide/wevu-jsx-tsx.runtime.test.ts:59`
- Routes: `/pages/jsx-basic/index`, `/pages/vue-tsx/index`
- Operations: `reLaunch(/pages/jsx-basic/index)`, `check(jsx:initial)`, `callMethodWithOptions(runE2E)`, `check(jsx:incremented)`, `reLaunch(/pages/vue-tsx/index)`, `check(vue-tsx:initial)`, `check(vue-tsx:disabled)`

### wevu JSX/TSX runtime [${runtimeProvider}] > renders cross-file TSX and dispatches dynamic island and component events

- Source: `e2e/ide/wevu-jsx-tsx.runtime.test.ts:81`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-jsx-tsx-demo`; checkpoints: `JSX_ISLAND_CHECKPOINTS`; source: `e2e/ide/wevu-jsx-tsx.runtime.test.ts:82`
- Routes: `/pages/tsx-basic/index`
- Operations: `reLaunch(/pages/tsx-basic/index)`, `check(island:initial)`, `callMethodWithOptions(runE2E)`, `check(island:incremented)`, `callMethodWithOptions(emitInfoCardChange)`, `check(island:component-event)`

### wevu JSX/TSX runtime [${runtimeProvider}] > runs setup render closures and SFC JSX/TSX script modes

- Source: `e2e/ide/wevu-jsx-tsx.runtime.test.ts:104`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-jsx-tsx-demo`; checkpoints: `JSX_SETUP_CHECKPOINTS`; source: `e2e/ide/wevu-jsx-tsx.runtime.test.ts:105`
- Routes: `/pages/setup-render/index`, `/pages/sfc-script-jsx/index`, `/pages/sfc-script-setup-tsx/index`
- Operations: `reLaunch(/pages/setup-render/index)`, `check(setup:initial)`, `callMethodWithOptions(increment)`, `check(setup:incremented)`, `reLaunch(/pages/sfc-script-jsx/index)`, `check(sfc-jsx:initial)`, `callMethodWithOptions(runE2E)`, `check(sfc-jsx:incremented)`, `reLaunch(/pages/sfc-script-setup-tsx/index)`, `check(sfc-setup:initial)`, `callMethodWithOptions(__weapp_vite_inline)`, `check(sfc-setup:updated)`

## ide/wevu-router-hmr.runtime.test.ts

### wevu/router HMR fixture runtime > keeps wevu/router resolved after saving a page in real DevTools HMR

- Source: `e2e/ide/wevu-router-hmr.runtime.test.ts:154`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-router-hmr`; checkpoints: `[ { id: 'router:initial', route: INDEX_ROUTE, action: '检查 router 页面标题与当前路由', nodes: [ { selector: '.title', text: BASE_MARKER }, { selector: '.route', text: INDEX_ROUTE }, ] }, { id: 'router:updated', route: INDEX_ROUTE, action: '保存后当前页面标题更`; source: `e2e/ide/wevu-router-hmr.runtime.test.ts:156`
- Routes: `/pages/index/index`, `pages/index/index`
- Operations: `reLaunch(/pages/index/index)`, `check(router:initial)`, `check(router:updated)`

## ide/wevu-runtime-demo.request-globals.weapp.test.ts

### wevu runtime demo request globals (weapp e2e) [cjs] > exposes request globals from the app runtime and request-globals index page

- Source: `e2e/ide/wevu-runtime-demo.request-globals.weapp.test.ts:113`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-runtime-demo`; checkpoints: `GLOBALS_CHECKPOINTS`; source: `e2e/ide/wevu-runtime-demo.request-globals.weapp.test.ts:114`
- Routes: `/pages/request-globals/index`, `/pages/request-globals/fetch`, `/pages/request-globals/graphql-request`, `/pages/request-globals/axios`
- Operations: `reLaunch(/pages/request-globals/index)`, `check(globals)`

### wevu runtime demo request globals (weapp e2e) [cjs] > supports fetch, graphql-request and axios in simulator runtime

- Source: `e2e/ide/wevu-runtime-demo.request-globals.weapp.test.ts:165`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-runtime-demo`; checkpoints: `REQUEST_CHECKPOINTS`; source: `e2e/ide/wevu-runtime-demo.request-globals.weapp.test.ts:166`
- Routes: `/pages/request-globals/fetch`, `/pages/request-globals/graphql-request`, `/pages/request-globals/axios`
- Operations: `reLaunch(/pages/request-globals/fetch)`, `check(fetch-1)`, `tap(<missing>)`, `check(fetch-2)`, `reLaunch(/pages/request-globals/graphql-request)`, `check(graphql-request-1)`, `check(graphql-request-2)`, `reLaunch(/pages/request-globals/axios)`, `check(axios-1)`, `check(axios-2)`

## ide/wevu-runtime-demo.vue-query.weapp.test.ts

### wevu runtime demo vue-query (weapp e2e) > resolves pending query and keeps query state reactive across tab switch and key rotation

- Source: `e2e/ide/wevu-runtime-demo.vue-query.weapp.test.ts:109`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-runtime-demo`; checkpoints: `VUE_QUERY_CHECKPOINTS`; source: `e2e/ide/wevu-runtime-demo.vue-query.weapp.test.ts:110`
- Routes: `/pages/vue-query/index`
- Operations: `reLaunch(/pages/vue-query/index)`, `check(initial)`, `tap(<missing>)`, `check(detail)`, `check(refreshed)`

## ide/wevu-runtime.class-computed.weapp.test.ts

### wevu runtime class computed (weapp e2e) > resolves class ternary with refs and computed values

- Source: `e2e/ide/wevu-runtime.class-computed.weapp.test.ts:44`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `CLASS_COMPUTED_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.class-computed.weapp.test.ts:45`
- Routes: `/pages/class-computed/index`
- Operations: `reLaunch(/pages/class-computed/index)`, `check(initial)`, `callMethodWithOptions(runE2E)`, `check(updated)`

## ide/wevu-runtime.core-hmr.test.ts

### wevu runtime core hmr matrix (ide) > keeps DevTools runtime aligned with core page, sfc and layout hmr updates

- Source: `e2e/ide/wevu-runtime.core-hmr.test.ts:590`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `coreHmrPlan({ pageTemplateMarker, pageScriptMarker, pageStyleMarker, sfcTemplateMarker, sfcScriptMarker, sfcStyleMarker, layoutPageTemplateMarker, layoutPageScriptMarker, layoutPageStyleMarker, sharedStoreMarker, })`; source: `e2e/ide/wevu-runtime.core-hmr.test.ts:601`
- Operations: `check(page:initial)`, `callMethodWithOptions(increment)`, `check(page:interacted)`, `check(page:template)`, `check(page:script)`, `check(page:style)`, `check(sfc:initial)`, `check(sfc:template)`, `check(sfc:script)`, `check(sfc:style)`, `check(layout:initial)`, `callMethodWithOptions(applyAdminLayout)`, `check(layout:admin)`, `check(layout:template)`, `callMethodWithOptions(syncScriptMarker)`, `check(layout:script)`, `check(layout:script-admin)`, `check(layout:style)`, `check(store:initial)`, `check(store:updated)`, `check(store:shared)`

## ide/wevu-runtime.function-props.weapp.test.ts

### wevu runtime function props (weapp e2e) > passes compiler-marked function props and respects allowFunctionProps false

- Source: `e2e/ide/wevu-runtime.function-props.weapp.test.ts:54`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `FUNCTION_PROPS_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.function-props.weapp.test.ts:55`
- Routes: `/pages/function-props-auto/index`, `/pages/function-props-disabled/index`, `/pages/function-props-dynamic/index`, `/pages/non-function-prop-bind/index`
- Operations: `reLaunch(/pages/function-props-auto/index)`, `check(auto-initial)`, `callMethodWithOptions(runE2E)`, `check(auto-invoked)`, `reLaunch(/pages/function-props-disabled/index)`, `check(disabled-initial)`, `check(disabled-invoked)`, `reLaunch(/pages/function-props-dynamic/index)`, `check(dynamic-initial)`, `check(dynamic-invoked)`, `reLaunch(/pages/non-function-prop-bind/index)`, `check(value-initial)`, `check(value-invoked)`

## ide/wevu-runtime.inline-object-reactivity.weapp.test.ts

### wevu runtime inline object reactivity (weapp e2e) > updates qty for minus/plus taps and enforces min bound

- Source: `e2e/ide/wevu-runtime.inline-object-reactivity.weapp.test.ts:386`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `INLINE_OBJECT_BOUND_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.inline-object-reactivity.weapp.test.ts:387`
- Routes: `/pages/wevu-inline-object-reactivity-repro/index`
- Operations: `reLaunch(/pages/wevu-inline-object-reactivity-repro/index)`, `callMethodWithOptions(runE2E)`, `callMethod(runE2E)`, `check(initial)`, `check(minus)`, `check(minimum)`, `check(plus)`, `check(plus-again)`, `check(restored)`

### wevu runtime inline object reactivity (weapp e2e) > keeps qty stable under repeated taps

- Source: `e2e/ide/wevu-runtime.inline-object-reactivity.weapp.test.ts:403`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `INLINE_OBJECT_REPEATED_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.inline-object-reactivity.weapp.test.ts:404`
- Routes: `/pages/wevu-inline-object-reactivity-repro/index`
- Operations: `reLaunch(/pages/wevu-inline-object-reactivity-repro/index)`, `callMethodWithOptions(runE2E)`, `callMethod(runE2E)`, `check(initial)`, `check(increased)`, `check(minimum)`, `check(increased-again)`

## ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts

### wevu runtime layout shared template/wxs hmr (ide) > updates layout runtime output in DevTools after shared template/include/wxs edits

- Source: `e2e/ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts:265`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `checkpoints`; source: `e2e/ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts:301`
- Routes: `/pages/layouts/index`
- Operations: `reLaunch(/pages/layouts/index)`, `check(layout-shared:0)`, `check(layout-shared:1)`, `check(layout-shared:2)`, `callMethodWithOptions(applyAdminLayout)`, `check(layout-shared:3)`, `check(CLASSIC_WXS_RELOAD_CHECKPOINT.id)`, `check(layout-shared:4)`, `check(layout-shared:5)`

## ide/wevu-runtime.shared-template-wxs.hmr.test.ts

### wevu runtime shared template/wxs hmr (ide) > updates runtime pages in DevTools after shared template/include/wxs edits

- Source: `e2e/ide/wevu-runtime.shared-template-wxs.hmr.test.ts:199`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `checkpoints`; source: `e2e/ide/wevu-runtime.shared-template-wxs.hmr.test.ts:235`
- Routes: `/pages/hmr/index`, `/pages/hmr-sfc/index`
- Operations: `reLaunch(/pages/hmr/index)`, `check(shared:0)`, `callMethodWithOptions(increment)`, `check(shared:1)`, `check(shared:2)`, `check(shared:3)`, `reLaunch(/pages/hmr-sfc/index)`, `check(shared:4)`, `check(shared:5)`, `check(CLASSIC_WXS_RELOAD_CHECKPOINT.id)`, `check(shared:6)`

## ide/wevu-runtime.weapp.test.ts

### wevu runtime (weapp e2e) [esm] > runs all pages and snapshots WXML

- Source: `e2e/ide/wevu-runtime.weapp.test.ts:185`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `RUNTIME_ALL_PAGE_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.weapp.test.ts:186`
- Routes: `/pages/reactivity/index`
- Operations: `reLaunch(/pages/reactivity/index)`, `reLaunch(route)`, `check(${name}:initial)`, `callMethodWithOptions(runE2E)`, `callMethodWithOptions(_runE2E)`, `check(${name}:result)`

### wevu runtime (weapp e2e) [esm] > triggers page scroll and prints debug console logs

- Source: `e2e/ide/wevu-runtime.weapp.test.ts:224`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `RUNTIME_SCROLL_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.weapp.test.ts:225`
- Routes: `/pages/reactivity/index`, `/pages/runtime/index`
- Operations: `reLaunch(/pages/reactivity/index)`, `reLaunch(/pages/runtime/index)`, `check(scroll:initial)`, `callMethod(getScrollDebugLogs)`, `callMethod(getHookLogs)`, `check(scroll:observed)`

### wevu runtime (weapp e2e) [esm] > switches native page layouts between default/admin/none at runtime

- Source: `e2e/ide/wevu-runtime.weapp.test.ts:280`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `RUNTIME_LAYOUT_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.weapp.test.ts:281`
- Routes: `/pages/reactivity/index`, `/pages/layouts/index`
- Operations: `reLaunch(/pages/reactivity/index)`, `reLaunch(/pages/layouts/index)`, `check(layout:0:default)`, `callMethodWithOptions(applyAdminLayout)`, `check(layout:1:admin)`, `callMethodWithOptions(clearLayout)`, `check(layout:2:none)`, `callMethodWithOptions(applyDefaultLayout)`, `check(layout:3:default)`

### wevu runtime (weapp e2e) [cjs] > runs all pages and snapshots WXML

- Source: `e2e/ide/wevu-runtime.weapp.test.ts:185`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `RUNTIME_ALL_PAGE_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.weapp.test.ts:186`
- Routes: `/pages/reactivity/index`
- Operations: `reLaunch(/pages/reactivity/index)`, `reLaunch(route)`, `check(${name}:initial)`, `callMethodWithOptions(runE2E)`, `callMethodWithOptions(_runE2E)`, `check(${name}:result)`

### wevu runtime (weapp e2e) [cjs] > triggers page scroll and prints debug console logs

- Source: `e2e/ide/wevu-runtime.weapp.test.ts:224`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `RUNTIME_SCROLL_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.weapp.test.ts:225`
- Routes: `/pages/reactivity/index`, `/pages/runtime/index`
- Operations: `reLaunch(/pages/reactivity/index)`, `reLaunch(/pages/runtime/index)`, `check(scroll:initial)`, `callMethod(getScrollDebugLogs)`, `callMethod(getHookLogs)`, `check(scroll:observed)`

### wevu runtime (weapp e2e) [cjs] > switches native page layouts between default/admin/none at runtime

- Source: `e2e/ide/wevu-runtime.weapp.test.ts:280`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-runtime-e2e`; checkpoints: `RUNTIME_LAYOUT_CHECKPOINTS`; source: `e2e/ide/wevu-runtime.weapp.test.ts:281`
- Routes: `/pages/reactivity/index`, `/pages/layouts/index`
- Operations: `reLaunch(/pages/reactivity/index)`, `reLaunch(/pages/layouts/index)`, `check(layout:0:default)`, `callMethodWithOptions(applyAdminLayout)`, `check(layout:1:admin)`, `callMethodWithOptions(clearLayout)`, `check(layout:2:none)`, `callMethodWithOptions(applyDefaultLayout)`, `check(layout:3:default)`

## ide/wevu-subpackage-placement.runtime.test.ts

### e2e app: wevu-subpackage-placement > reLaunches main, normal subpackage, and independent subpackage vue routes

- Source: `e2e/ide/wevu-subpackage-placement.runtime.test.ts:76`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/wevu-subpackage-placement`; checkpoints: `subpackagePlacementCheckpoints`; source: `e2e/ide/wevu-subpackage-placement.runtime.test.ts:77`
- Operations: `reLaunch(route)`, `check(${routeCase.id}:initial)`, `callMethodWithOptions(runE2E)`, `check(${routeCase.id}:result)`

## ide/wevu-vue-demo.script-setup.emit.runtime.test.ts

### wevu-vue-demo script setup emit runtime > unwraps emitted detail for handler / $event / inline $event.title and preserves native event payloads

- Source: `e2e/ide/wevu-vue-demo.script-setup.emit.runtime.test.ts:42`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `apps/wevu-vue-demo`; checkpoints: `EMIT_CHECKPOINTS`; source: `e2e/ide/wevu-vue-demo.script-setup.emit.runtime.test.ts:43`
- Operations: `reLaunch(EMIT_ROUTE)`, `check(initial)`, `tap(<missing>)`, `check(reset)`, `check(testCase.id)`

## ide/wevu-watch.test.ts

### wevu watch controls (e2e) > supports pause/resume/stop via destructuring

- Source: `e2e/ide/wevu-watch.test.ts:61`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/app-lifecycle-wevu-ts`; checkpoints: `[ { id: 'watch:initial', route: '/pages/index/index', action: '检查 watcher 初始界面', nodes: [ { selector: '#app-lifecycle-route', text: 'App lifecycle wevu' }, { selector: '#watch-result', text: 'watch results: 0' }, { selector: '.watch-result-`; source: `e2e/ide/wevu-watch.test.ts:62`
- Routes: `/pages/index/index`
- Operations: `reLaunch(/pages/index/index)`, `check(watch:initial)`, `callMethodWithOptions(runWatchE2E)`, `check(watch:result)`

## ide/chunk-modes.runtime.duplicate.test.ts

### e2e app: chunk-modes runtime duplicate matrix > runs without runtime errors in devtools for duplicate-common-none-preserve

- Source: `e2e/ide/chunk-modes.runtime.shared.ts:382`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/chunk-modes`; checkpoints: `runtimeCase.routes.map(routeCase => chunkRouteCheckpoint(runtimeCase.id, routeCase))`; source: `e2e/ide/chunk-modes.runtime.shared.ts:383`
- Routes: `/pages/index/index`, `/packageA/pages/foo`, `/packageB/pages/bar`
- Operations: `reLaunch(/pages/index/index)`, `check(/pages/index/index)`, `reLaunch(/packageA/pages/foo)`, `check(/packageA/pages/foo)`, `reLaunch(/packageB/pages/bar)`, `check(/packageB/pages/bar)`
- Each chunk topology reLaunches every runtimeBaseRoutes page through withBaseRoutes

### e2e app: chunk-modes runtime duplicate matrix > runs without runtime errors in devtools for duplicate-inline-mixed-inline

- Source: `e2e/ide/chunk-modes.runtime.shared.ts:382`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/chunk-modes`; checkpoints: `runtimeCase.routes.map(routeCase => chunkRouteCheckpoint(runtimeCase.id, routeCase))`; source: `e2e/ide/chunk-modes.runtime.shared.ts:383`
- Routes: `/pages/index/index`, `/packageA/pages/foo`, `/packageB/pages/bar`
- Operations: `reLaunch(/pages/index/index)`, `check(/pages/index/index)`, `reLaunch(/packageA/pages/foo)`, `check(/packageA/pages/foo)`, `reLaunch(/packageB/pages/bar)`, `check(/packageB/pages/bar)`
- Each chunk topology reLaunches every runtimeBaseRoutes page through withBaseRoutes

## ide/chunk-modes.runtime.extras.test.ts

### e2e app: chunk-modes runtime extras matrix > runs without runtime errors in devtools for path-root-shared

- Source: `e2e/ide/chunk-modes.runtime.shared.ts:382`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/chunk-modes`; checkpoints: `runtimeCase.routes.map(routeCase => chunkRouteCheckpoint(runtimeCase.id, routeCase))`; source: `e2e/ide/chunk-modes.runtime.shared.ts:383`
- Routes: `/pages/index/index`, `/packageA/pages/foo`, `/packageB/pages/bar`
- Operations: `reLaunch(/pages/index/index)`, `check(/pages/index/index)`, `reLaunch(/packageA/pages/foo)`, `check(/packageA/pages/foo)`, `reLaunch(/packageB/pages/bar)`, `check(/packageB/pages/bar)`
- Each chunk topology reLaunches every runtimeBaseRoutes page through withBaseRoutes

## ide/chunk-modes.runtime.hoist.test.ts

### e2e app: chunk-modes runtime hoist matrix > runs without runtime errors in devtools for hoist-common-mixed-inline

- Source: `e2e/ide/chunk-modes.runtime.shared.ts:382`
- Plan: registered in source; runtime verification required
- Registration: `createDomAcceptance`; fixture: `e2e-apps/chunk-modes`; checkpoints: `runtimeCase.routes.map(routeCase => chunkRouteCheckpoint(runtimeCase.id, routeCase))`; source: `e2e/ide/chunk-modes.runtime.shared.ts:383`
- Routes: `/pages/index/index`, `/packageA/pages/foo`, `/packageB/pages/bar`
- Operations: `reLaunch(/pages/index/index)`, `check(/pages/index/index)`, `reLaunch(/packageA/pages/foo)`, `check(/packageA/pages/foo)`, `reLaunch(/packageB/pages/bar)`, `check(/packageB/pages/bar)`
- Each chunk topology reLaunches every runtimeBaseRoutes page through withBaseRoutes
