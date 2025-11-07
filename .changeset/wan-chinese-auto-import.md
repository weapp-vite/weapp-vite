---
"weapp-vite": minor
---

feat: 自动导入组件改为默认开启，自动扫描主包与各分包的 `components/` 目录，同时支持通过 `autoImportComponents: false` 或 `subPackages.<root>.autoImportComponents = false` 完全禁用该能力；同步更新示例与文档，方便分包独立维护自动导入策略。
