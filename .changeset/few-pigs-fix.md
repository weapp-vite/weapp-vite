---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 Windows 环境下的路径分隔符兼容问题。现在 `create-weapp-vite` 的模板文件校验会统一使用 POSIX 相对路径，`weapp-vite` 在分包 `miniprogram_npm` 复制阶段也会正确处理 Windows 原生路径，避免出现 CI 断言误报以及分包 npm 产物缺失的问题。
