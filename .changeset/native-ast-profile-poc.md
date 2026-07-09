---
"@weapp-vite/ast": patch
"@wevu/compiler": patch
---

为 AST native 迁移评估补充可选 POC：`onPageScroll` 诊断、static require、platform API、feature flags 与导入 Vue SFC metadata 解析在显式启用 native 模块时优先使用 `@weapp-vite/ast-native`，加载失败或未配置时继续回退现有 Babel / Oxc / Vue compiler-sfc 路径。同时新增脚本级 batch analysis native 入口，让同一份源码的多个轻量 AST 检查共享一次 JS ↔ Rust 通信和一次 parse，并修复 AST 迁移 profile 脚本，使其输出当前 `transformScript`、`compileVueFile`、analysis-only POC 阶段耗时和 Amdahl 收益估算。
