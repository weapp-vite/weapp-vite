---
"wevu": patch
"website-weapp-vite": patch
---

补齐组件 `lifetimes/pageLifetimes` 的 hook 派发能力：

- wevu：新增 `onMoved` / `onError` / `onResize`，分别对应 `lifetimes.moved` / `lifetimes.error` / `pageLifetimes.resize`。
- 文档：补充 `defineComponent` 组件侧 lifetimes/pageLifetimes → wevu hooks 对照表。

