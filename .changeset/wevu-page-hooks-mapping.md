---
"wevu": minor
---

补齐 Page 页面事件 hooks，并增强 `features` 用途：

- `features` 用于**按需注入**页面事件处理函数（仍保持默认不注入，避免无效事件派发带来的性能与 UI 影响）。当你只在 `setup()` 里注册 hook 时，可通过 `features` 显式开启对应页面事件（例如 `onShareTimeline` 需要在注册阶段存在才会展示菜单按钮）。
- 新增页面 hooks：`onLoad`、`onPullDownRefresh`、`onReachBottom`。
- 新增文档 `docs/wevu/page-hooks-mapping.md`，提供 wevu hooks 与原生 Page 生命周期/事件回调的 1:1 对应表。
