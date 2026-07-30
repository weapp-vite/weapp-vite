# mpcore

`mpcore` 是一个独立的生态工作区根目录。

当前子包布局：

- `mpcore/packages/core`
- `mpcore/packages/simulator`
- `mpcore/packages/test`
- `mpcore/packages/vitest`
- `mpcore/packages/weapp-vite`

`@mpcore/simulator` 负责执行微信小程序编译产物和模拟宿主；`@mpcore/test` 提供页面/组件渲染、逻辑 WXML 查询、交互、mock 与诊断；`@mpcore/vitest` 管理每测试隔离和 matcher；`@mpcore/weapp-vite` 负责生成真实 weapp-vite 测试产物。测试环境不提供浏览器 `document/window`。
