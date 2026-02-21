---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 组件类型暴露导致的模板补全噪声问题：`defineComponent` 的公开返回类型不再把内部运行时字段作为可补全属性暴露，避免在 Vue SFC 中出现 `:__wevu_options`、`:__wevu_runtime` 及 symbol 序列化键提示。同时同步更新 `lib-mode` 的类型断言用例，确保构建产物导出的组件类型与新的公开契约保持一致。
