---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复本地自动导入组件的文件名与模板标签分别使用 kebab-case 和 PascalCase 时无法解析的问题，统一按组件名的 kebab-case 语义匹配，同时保留原有注册名和生成路径。
