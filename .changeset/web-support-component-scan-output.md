---
'weapp-vite': patch
'create-weapp-vite': patch
---

fix(weapp-vite): 修复纯 Web 构建预生成支持文件时误将项目根目录作为输出排除范围，导致本地组件类型和编辑器提示被清空的问题；组件扫描改用实际 Web 输出目录，并继续排除输出目录中的生成文件。
