---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue layout 在小程序构建输出中的脚本兜底与页面依赖发射逻辑，避免 `usingComponents` 指向的布局组件缺少 `.js` 产物时导致运行时空白。同时同步更新相关模板 e2e 快照与断言，覆盖默认布局包裹、布局页面入口和子包模板产物变化。
