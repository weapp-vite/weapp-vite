---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生页面通过 `usingComponents` 引入组件时的入口类型传播错误。现在 `weapp-vite` 会将这类下游入口显式标记为组件，避免在构建阶段误按页面处理并套用默认 layout，从而消除首页嵌套组件重复渲染 layout 外壳的问题，并补充对应的回归测试覆盖。
