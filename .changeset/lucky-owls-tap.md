---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复测试产物遇到解析器注册文件系统根目录监听时递归扫描整盘的问题，避免 Windows 受保护目录触发 EPERM，同时保留显式源码依赖的内容失效检测。
