# Issue #1065：第三方编译 provider

`fakeProvider.ts` 仅消费公开协议，正常 CLI 加载配置后执行 CSS、WXML、JS、bundle、监听和资源释放；未 mock 宿主 hook，也不直接写出构建产物。`provider-events.jsonl` 只记录测试生命周期。

- `e2e/ci/issue-1065-provider.test.ts`：生产构建、外部样式和导入链、所有权冲突、classic 连续依赖更新、会话关闭只释放一次。
- `e2e/ide/issue-1065-provider.runtime.test.ts`：同一会话连续 JS 更新/恢复、模板属性、按钮事件和状态保持；依赖红→蓝→绿→红更新同时检查 WXSS，DevTools 额外严格检查计算色。
- `mpcore/packages/weapp-vite/src/compilerProvider.integration.test.ts`：公开构建适配器生成的真实 provider 产物、页面和事件。

运行前重建 `weapp-vite`，先串行执行 headless，再执行 DevTools。同一 runtime suite 只启动一次 automator。headless 不提供浏览器计算样式，不能用其通过替代 DevTools 的颜色断言。

当前 DevTools 2.02.2609231 RC / 基础库 3.17.2 下，连续 JS 用例通过；样式产物更新而计算色停留在上一轮，严格用例保持失败。相同设置的原生 Page 对照也复现，完整窗口、新旧文件监听和非隐藏临时目录对照均未解除阻塞。因此本 fixture 尚不表示 #1065 完成最终验收。
