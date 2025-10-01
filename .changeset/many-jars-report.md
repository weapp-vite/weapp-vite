---
"@weapp-core/init": major
---

- 将 init 入口拆分为项目配置、包初始化、配置文件生成、模板创建等独立模块，保持对外 API 不变
- 新增通用的文件与路径工具、健壮的 npm 版本解析，以及非破坏式的 .gitignore 合并，提升项目初始化可靠性
- 发布时自动将模板内的 `.gitignore` 重命名为 `gitignore`，并在项目生成后恢复为 `.gitignore`，确保忽略规则正确下发
