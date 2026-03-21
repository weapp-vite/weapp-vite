---
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-retail-template': patch
'create-weapp-vite': patch
---

为两个 TDesign wevu 模板统一收敛通用反馈节点：默认 layout 现在承载 `t-toast` 与 `t-dialog`，页面与组件通过封装方法触发提示与确认弹窗，同时补充对应的构建级集成测试，避免页面重新各自挂载通用反馈实例。
