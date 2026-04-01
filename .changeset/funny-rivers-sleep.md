---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `custom-tab-bar` 与 `app-bar` 被错误按页面入口处理的问题。现在它们会始终按组件入口参与构建，不会再命中 `layouts/default` 这类页面布局包裹逻辑；同时补充 `github-issues` 的 issue #380 构建回归用例，覆盖默认布局存在时的自定义 tab bar 场景。
