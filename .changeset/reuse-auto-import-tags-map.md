---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

复用 Vue SFC 编译阶段已经解析出的自动导入组件映射，避免生成页面 JSON 时再次扫描模板并重复调用组件 resolver，降低自动导入组件较多时的编译开销。
