---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

合并 Vue SFC 编译阶段的模板组件标签扫描，自动 using component 与自动导入标签复用同一次模板解析结果，减少组件较多页面的重复解析开销。
