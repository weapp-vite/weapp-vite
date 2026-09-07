---
"@mpcore/simulator": patch
---

修复模拟器无法加载小程序组件包内 npm 依赖的问题。Node 与浏览器共用产物目录解析规则，优先查找组件包嵌套的 miniprogram_npm，再逐级查找到小程序根目录，支持作用域包和子路径，同时避免回退宿主 node_modules 或越过产物边界。
