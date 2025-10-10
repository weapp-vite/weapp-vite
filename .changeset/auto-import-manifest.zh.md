---
"weapp-vite": patch
---

为 `weapp.enhance.autoImportComponents` 新增自动生成 `auto-import-components.json` 清单功能，支持通过 `output` 字段配置输出路径或关闭生成，同时内置解析器会将所有可自动导入的第三方组件写入清单，便于 IDE 补全及调试。
