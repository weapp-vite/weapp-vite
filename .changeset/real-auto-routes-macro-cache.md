---
'@wevu/compiler': patch
---

修复 JSON 宏临时文件默认落到系统临时目录时对项目内包名导入的解析问题。现在在常规项目目录下会默认使用项目内的 `.weapp-vite/wevu-config` 作为缓存根目录，避免 `defineAppJson()` 等宏在求值 `weapp-vite/auto-routes` 这类包名导入时出现未解析警告。
