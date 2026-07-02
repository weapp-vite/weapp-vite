---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 编译与自动导入支持文件生成路径：减少 `transformScript` 的重复 Babel 遍历，复用已计算的 props 派生信息，并在生成组件类型支持文件时用轻量 Vue props 分析替代完整 SFC 编译。
