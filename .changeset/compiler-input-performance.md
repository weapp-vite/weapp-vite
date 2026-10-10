---
'create-weapp-vite': patch
'weapp-vite': patch
---

perf(compiler): 复用 Vue 分析、真实路径和配置周期内的包解析，减少重复文件系统查询与无关清单加载。

- 合并 Vue 模板和 script setup 分析，保留外部 template src、脚本和新发现组件的失效与完整模板/JSON 发布；未使用 Wevu 页面能力的脚本跳过无关清单加载。
- 单次同步操作内复用成功的真实路径查询，按配置生命周期复用包解析和 Oxc 支持；后续操作、配置重载和依赖变化仍重新核验。统一 Windows 分隔符、盘符、短路径与项目根身份，保留 `preserveSymlinks` 语义。
