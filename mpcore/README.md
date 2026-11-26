# mpcore

`mpcore` 是一个独立的生态工作区根目录。

当前子包布局：

- `mpcore/packages/core`
- `mpcore/packages/simulator`
- `mpcore/packages/test`
- `mpcore/packages/vitest`
- `mpcore/packages/weapp-vite`

`@mpcore/simulator` 负责执行微信小程序编译产物和模拟宿主；`@mpcore/test` 提供页面/组件渲染、逻辑 WXML 查询、交互、mock 与诊断。weapp-vite 通过 `weapp-vite/test` 暴露真实产物构建与 headless 测试 API，通过 `weapp-vite/e2e` 暴露微信开发者工具 automator API。`@mpcore/vitest` 只提供可选的 Vitest 配置注入和生命周期辅助，不替换 Vitest 原生测试 API。测试环境不提供浏览器 `document/window`。
