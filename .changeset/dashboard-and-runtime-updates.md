---
"@weapp-vite/dashboard": patch
"@weapp-vite/vscode": patch
"create-weapp-vite": patch
"weapp-vite": patch
"wevu": patch
---

增强 analyze 与 dashboard 能力：`wv analyze` 新增组件依赖洞察、包体预算门禁、PR/Markdown 报告、历史快照、真实 gzip/brotli 体积、历史对比、预算告警、重复模块建议、来源细分数据，以及受限源码和产物内容读取能力，方便上层 UI 定位源码到产物的体积差异。

系统增强 Analyze Dashboard：重构分析视图信息架构，新增左侧分析分组导航、可拖拽并本地记忆的视图布局、全局搜索命令面板、导出中心、当前视图链接复制、视图重置、发布门禁、PR 风险清单、处理清单、预算沙盘、包体健康分、历史趋势、源码对比、运行事件摘要和工作台 readiness 摘要，并将 dashboard 本地开发与预览服务默认端口调整为 6188，端口冲突时自动递增。

优化模板、运行时与编辑器体验：模板项目默认安装 `@weapp-vite/dashboard`，补充 `dev:ui` 与 `dev:open:ui` 脚本，并在 VS Code 推荐扩展中加入 weapp-vite 扩展；压缩 wevu 默认发布构建产物，同时提供未压缩开发产物，支持通过 development 条件导出和 `wevu/dev` 子路径切换到可读源码；优化 VS Code 中 WXML 与 Vue template 的 class、`wx:for` 隐式成员表达式和 kebab 名称跳转体验。

稳定微信开发者工具启动链路：应用配置产物现在会始终输出规范的 `subPackages: []`，并在 IDE e2e 启动前校验 `app.json` 的 pages 与分包字段形态，避免开发者工具在模拟器启动阶段读到不完整配置后抛出 `subPackages` 相关错误。
