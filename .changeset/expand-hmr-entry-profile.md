---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

细化 HMR profile 中 page/component 入口加载阶段的耗时拆分，补充脚本读取、JSON 读取、模板扫描、自动导入、样式 sidecar 扫描/读取、入口 resolve、入口 chunk emit 和 layout 处理等子项，方便定位热更新真实瓶颈；同时在 direct script HMR 中复用已缓存的入口 JSON、loadEntry 层入口 JSON、JSON/Vue sidecar 解析结果、模板路径、样式 sidecar 列表、Vue `<json>` 配置块结果，以及无 layout hint 的原生 page 和 Vue page layout plan，并复用原生 page layout 分析时已读取的入口源码，减少未变更元数据文件的重复探测、重读和重解析。命中入口 JSON 缓存时不再重复 structuredClone 并写回 loadEntry 缓存。默认 weapp 平台且没有 npm/local-root/platform API 后续改写任务时，也会跳过 bundle script-analysis 预热，避免对未消费的 HMR chunk 做多余 AST 分析；同时收紧动态全局 rewrite 和 wevu runtime import rewrite 的文本命中条件，避免 `runSetupFunction(` 或源码注释里的 `wevu/src` 让 SFC/wevu runtime 大 chunk 被重复扫描；主包单入口 HMR bundle 如果没有 shared virtual chunk 或分包 chunk，也会跳过 shared chunk importer index 构建。`@wevu/compiler` 在 sourcemap 关闭、无模板元数据注入且命中 Vue 标准 `<script setup>` 编译产物时，新增粗粒度脚本快路径，直接复用已编译脚本并完成 wevu options 包装，避免对同一份源码再执行 Babel parse/traverse/generate。自动导入组件 support files 同步会跳过纯本地组件或全静态 full resolver 场景下不必要的模板标签扫描，并把初始 glob 扫描注册合并到同一个 batch 中，减少 dev/build 启动阶段的重复输出调度。Vue SFC HMR profile 进一步拆分源码读取、编译、编译结果 finalize 和返回代码 finalize 子阶段，用真实热路径数据约束后续 native AST 迁移范围，避免在占比很低的 Babel/Vue AST 单点上继续扩大细粒度 native 调用。
