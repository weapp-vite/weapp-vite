# #1015 外部 CSS 变量连续 HMR 诊断与修复

## 结论

基线为 `main@7161aaa1f217`。在微信开发者工具 `2.02.2608070`、基础库 `3.17.3` 中，classic 与 stateful-experimental 均完成七步连续更新，14 个 DOM checkpoint 全部通过，运行时 error/exception 为 0。

本轮修复尚未发布。合入并发布后，#1015 报告的外部 `style src` CSS 变量静态编译与连续 HMR 路径均有完整回归覆盖。

## 根因

连续删除并恢复 CSS 变量会同时改变脚本注册、模板 style binding 和 shared chunk 导出形状。实际存在三个相互独立的生命周期问题：

1. stateful 完整重建的 App 入口先由 DevEngine 生成注册 banner，随后又被普通 SFC 脚本替换，导致原生 App 注册初始化丢失并白屏。
2. CSS 变量集合变空时，编译器会移除 `useCssVars`、`unref` 和模板 style binding；变量恢复后，微信宿主的热重载无法可靠恢复此前移出的模块和导出。
3. classic dev 增量编译缓存了带 `resolve`/`emitFile` 的 compile options。Rolldown 重建后会复用 hook context 外壳，但其内部 plugin driver 已释放，后续读取外部样式会报 `Plugin driver is already dropped`。

原生 A/B 进一步确认：宿主开启 `compileHotReLoad` 时，模块或导出被移除后再加入会出现模块未定义或函数导出缺失；保持依赖及完整导出形状时可以稳定通过。这一结果用于确定兼容边界，没有把宿主缺陷写成框架通过。

## 修复机制

- bundled dev 模式下，App 可执行入口只由 DevEngine 持有；普通 SFC emit 不再覆盖该入口。
- 仅在 stateful-experimental 开发模式下稳定 CSS 变量运行时形状：所有 SFC 保留空 `useCssVars` 注册、`unref` value import 和模板 style binding。有真实 CSS 变量时，编译器生成的实际注册随后覆盖空结果。
- classic dev 每次 transform 重新绑定带 hook 能力的 compile options。生产单次构建仍可复用缓存，不新增公共配置。
- 空注册兼容对象方法、函数 setup、表达式体箭头 setup 和 Vue type-only import；不会追加第二个 setup 或把 value import 混入 type import。

## 回归场景

真实 DevTools 场景对 classic 与 stateful-experimental 分别执行：

1. 初始外部变量为红色。
2. 仅修改普通 CSS 背景。
3. 将 `style src` 切换到另一文件。
4. 将变量从 `themeColor` 替换为 `accentColor`。
5. 删除全部 `v-bind`，颜色变为黑色。
6. 恢复 `themeColor`，颜色恢复红色。
7. 触发响应式更新，颜色变为蓝色。

每一步同时检查生成 WXSS marker、当前页面 DOM、计算颜色、页面状态和运行时异常。suite 为每种 runtime 启动一次 automator，更新过程复用同一会话；fixture 使用真实 AppID，并登记条件页。

验证命令：

```sh
pnpm --filter @wevu/compiler build
pnpm --filter wevu build
pnpm --filter weapp-vite build
pnpm --filter @wevu/compiler typecheck
pnpm --filter @wevu/compiler test
pnpm --filter weapp-vite typecheck
pnpm -C mpcore/packages/simulator test:e2e -- statefulAppBootstrap.e2e.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/github-issues.runtime.issue1015.test.ts
WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-1015-css-hmr.runtime.test.ts
```

实际结果：

- `@wevu/compiler`：89 个测试文件、957 项测试通过。
- weapp-vite 与 simulator 相关单测：67 项通过。
- simulator browser E2E：44 个测试文件、93 项测试通过。
- headless provider：外部 CSS 变量首屏绑定与 red 到 blue 响应式更新通过，零运行时错误。
- 微信 DevTools：classic 7/7、stateful-experimental 7/7，零运行时错误和异常。

`compileOptions.ts` 已超过 300 行，但本次只调整该文件已有的缓存所有权判断；拆分会割裂选项构建与缓存策略，因此本 PR 不做无关结构重排。
