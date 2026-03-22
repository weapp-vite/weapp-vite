---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu` 组件模板 ref 代理在写入自定义字段时没有回写到真实组件实例的问题，避免 layout 内承载的 `t-dialog` 在通过 `useDialog()` 打开后出现确认、取消按钮无法关闭弹窗的情况。同步补强 TDesign wevu 模板中的 dialog 宿主关闭兜底逻辑，并增加对应的运行时单测与 DevTools e2e 回归用例。
