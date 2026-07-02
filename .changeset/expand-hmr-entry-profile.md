---
"weapp-vite": patch
"create-weapp-vite": patch
---

细化 HMR profile 中 page/component 入口加载阶段的耗时拆分，补充脚本读取、JSON 读取、模板扫描、自动导入、样式 sidecar 扫描/读取、入口 resolve、入口 chunk emit 和 layout 处理等子项，方便定位热更新真实瓶颈；同时在 direct script HMR 中复用已缓存的入口 JSON、loadEntry 层入口 JSON、JSON/Vue sidecar 解析结果、模板路径、样式 sidecar 列表、Vue `<json>` 配置块结果，以及无 layout hint 的原生 page 和 Vue page layout plan，并复用原生 page layout 分析时已读取的入口源码，减少未变更元数据文件的重复探测、重读和重解析。默认 weapp 平台且没有 npm/local-root/platform API 后续改写任务时，也会跳过 bundle script-analysis 预热，避免对未消费的 HMR chunk 做多余 AST 分析；同时收紧动态全局 rewrite 和 wevu runtime import rewrite 的文本命中条件，避免 `runSetupFunction(` 或源码注释里的 `wevu/src` 让 SFC/wevu runtime 大 chunk 被重复扫描；主包单入口 HMR bundle 如果没有 shared virtual chunk 或分包 chunk，也会跳过 shared chunk importer index 构建。
