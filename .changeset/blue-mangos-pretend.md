---
'create-weapp-vite': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-retail-template': patch
---

修复两个 wevu + TDesign 模板中 `Toast/Dialog` 反馈宿主的挂载位置。模板现在将反馈节点放回实际触发它们的页面或组件，避免首页、布局页和零售模板相关页面在微信开发者工具中触发提示时出现“未找到组件,请检查selector是否正确”的运行时警告。
