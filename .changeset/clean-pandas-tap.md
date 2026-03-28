---
'weapp-vite': patch
'rolldown-require': patch
'create-weapp-vite': patch
---

修复 Windows 环境下的路径与包元数据兼容问题。`weapp-vite` 现在会将 watch file 路径统一规范化为 POSIX 形式，避免布局与依赖监听在 Windows 上产出反斜杠路径；`rolldown-require` 现在会在读取 `package.json` 时自动去除 UTF-8 BOM，避免部分环境下解析版本信息时报 JSON 语法错误。
