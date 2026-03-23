---
"create-weapp-vite": patch
---

修复 workspace 场景下 `create-weapp-vite` 解析模板目录失败的问题，并在复制模板时跳过模板内的构建产物与 `node_modules` 等冗余内容。同时保留目标目录原有的 `.gitignore` 条目，避免初始化项目时覆盖用户已有忽略规则。
